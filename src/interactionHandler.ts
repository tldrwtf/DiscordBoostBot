import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  UserContextMenuCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  GuildMember,
  Message,
  MessageFlags,
} from "discord.js";
import { CATALOG, findProduct } from "./catalog.js";
import {
  CUSTOM_IDS,
  buildClaimActionRow,
  buildPanelButtonRow,
  buildTicketActionRows,
  buildWizardRows,
  isDraftComplete,
  normalizeServiceMode,
} from "./components.js";
import { quoteOrder } from "./pricing.js";
import { buildTicketChannelName, createOrderId, isImageAttachment, isImageUrl } from "./utils.js";
import {
  buildAuditEmbed,
  buildClaimEmbed,
  buildCompletedEmbed,
  buildOrderPanelPayload,
  buildTicketSummaryPayload,
  buildWizardPayload,
} from "./embeds.js";
import { canCompleteOrder, isBoosterMember, isStaffMember } from "./permissions.js";

import type { Client, Guild } from "discord.js";
import type { BotConfig, DraftSelection, NewOrderInput, OrderRecord, ProductConfig, TicketMetadata } from "./types.js";
import type { OrdersRepository } from "./db/ordersRepository.js";
import type { DraftStore } from "./draftStore.js";

const SUPPORTED_PROOF_IMAGE_TYPES = "PNG, JPG, JPEG, WEBP, or GIF";

export class InteractionHandler {
  constructor(
    private client: Client,
    private config: BotConfig,
    private repository: OrdersRepository,
    private drafts: DraftStore,
  ) {}

  public async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.commandName === "deploy-order-panel") {
      const member = this.getMember(interaction);
      if (!isStaffMember(member, this.config) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only staff can deploy the order panel." });
        return;
      }

      const productId = interaction.options.getString("service", true) as ProductConfig["id"];
      const product = findProduct(CATALOG, productId);
      if (!product || !product.enabled) {
        throw new Error("Select an enabled product before deploying a panel.");
      }

      const providedChannel = interaction.options.getChannel("channel");
      const channel =
        providedChannel && providedChannel.type === ChannelType.GuildText
          ? (providedChannel as TextChannel)
          : this.getOrderChannel(interaction.guild!, this.config.orderHereChannelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error("Run this command in a text channel or choose a valid text channel.");
      }

      const panelPayload = buildOrderPanelPayload(this.config, product);
      await channel.send({
        embeds: panelPayload.embeds,
        files: panelPayload.files,
        components: [buildPanelButtonRow(product)],
      });

      await interaction.reply({ flags: MessageFlags.Ephemeral, content: `${product.label} panel deployed in ${channel}.` });
      return;
    }

    if (interaction.commandName === "order") {
      const productId = interaction.options.getString("service", true) as ProductConfig["id"];
      const product = findProduct(CATALOG, productId);
      if (!product || !product.enabled) {
        throw new Error("That product is currently unavailable.");
      }

      const draft = this.drafts.reset(interaction.user.id);
      draft.productId = productId;
      await this.replyWithWizard(interaction, draft, "reply");
    }
  }

  public async handleUserContextMenu(interaction: UserContextMenuCommandInteraction): Promise<void> {
    const member = this.getMember(interaction);
    if (!isStaffMember(member, this.config)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only staff can manage orders." });
      return;
    }

    const targetUser = interaction.targetUser;
    const activeOrders = this.repository.listActive().filter((o) => o.customerId === targetUser.id);

    if (activeOrders.length === 0) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `User **${targetUser.tag}** has no active orders.`,
      });
      return;
    }

    const embed = buildAuditEmbed(
      this.config,
      `Active Orders: ${targetUser.tag}`,
      activeOrders
        .map(
          (o) =>
            `**${o.productLabel}** (${o.id})\nStatus: \`${o.status}\` | Price: **${o.nativeTotal}${o.nativeCurrency}** (${o.usdTotal}$)\nTicket: <#${o.ticketChannelId}>`,
        )
        .join("\n\n"),
    );

    await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [embed] });
  }

  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (interaction.customId.startsWith(`${CUSTOM_IDS.getBoosted}:`)) {
      const productId = interaction.customId.split(":")[2] as ProductConfig["id"];
      const draft = this.drafts.reset(interaction.user.id);
      const product = findProduct(CATALOG, productId);
      if (!product || !product.enabled) {
        throw new Error("That product panel is no longer available.");
      }
      draft.productId = product.id;
      await this.replyWithWizard(interaction, draft, "reply");
      return;
    }

    if (interaction.customId === CUSTOM_IDS.openRangeModal) {
      const draft = this.drafts.get(interaction.user.id);
      const product = draft.productId ? findProduct(CATALOG, draft.productId) : undefined;
      if (!product || product.selectionMode !== "numeric_range") {
        throw new Error("Numeric input is not available for the current selection.");
      }

      const modal = new ModalBuilder()
        .setCustomId(CUSTOM_IDS.rangeModal)
        .setTitle(`${product.label} values`);

      const currentInput = new TextInputBuilder()
        .setCustomId("current")
        .setLabel(product.currentLabel)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(`Example: ${product.min}`)
        .setValue(draft.currentValue ?? "");

      const desiredInput = new TextInputBuilder()
        .setCustomId("desired")
        .setLabel(product.targetLabel)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(`Example: ${product.max}`)
        .setValue(draft.desiredValue ?? "");

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(currentInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(desiredInput),
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId.startsWith(`${CUSTOM_IDS.confirmPayment}:`)) {
      await this.handleConfirmPayment(interaction);
      return;
    }

    if (interaction.customId.startsWith(`${CUSTOM_IDS.searchBooster}:`)) {
      await this.handleSearchBooster(interaction);
      return;
    }

    if (interaction.customId.startsWith(`${CUSTOM_IDS.submitProofLink}:`)) {
      await this.handleOpenProofLinkModal(interaction);
      return;
    }

    if (interaction.customId.startsWith(`${CUSTOM_IDS.completeOrder}:`)) {
      await this.handleCompleteOrder(interaction);
      return;
    }

    if (interaction.customId.startsWith(`${CUSTOM_IDS.closeTicket}:`)) {
      await this.handleCloseTicket(interaction);
      return;
    }

    if (interaction.customId.startsWith(`${CUSTOM_IDS.acceptBoost}:`)) {
      await this.handleAcceptBoost(interaction);
    }
  }

  public async handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const userId = interaction.user.id;
    const selectedValue = interaction.values[0];
    let draft = this.drafts.get(userId);

    switch (interaction.customId) {
      case CUSTOM_IDS.productSelect:
        draft = this.drafts.patch(userId, {
          productId: selectedValue as any,
          serviceMode: undefined,
          profileId: undefined,
          currentValue: undefined,
          desiredValue: undefined,
          packageValue: undefined,
        });
        break;
      case CUSTOM_IDS.serviceSelect:
        draft = this.drafts.patch(userId, {
          serviceMode: normalizeServiceMode(selectedValue),
        });
        break;
      case CUSTOM_IDS.profileSelect:
        draft = this.drafts.patch(userId, {
          profileId: selectedValue,
          currentValue: undefined,
          desiredValue: undefined,
        });
        break;
      case CUSTOM_IDS.currentSelect:
        draft = this.drafts.patch(userId, {
          currentValue: selectedValue,
          desiredValue: undefined,
        });
        break;
      case CUSTOM_IDS.desiredSelect:
        draft = this.drafts.patch(userId, {
          desiredValue: selectedValue,
        });
        break;
      case CUSTOM_IDS.packageSelect:
        draft = this.drafts.patch(userId, {
          packageValue: selectedValue,
        });
        break;
      default:
        return;
    }

    const product = draft.productId ? findProduct(CATALOG, draft.productId) : undefined;
    if (product && isDraftComplete(product, draft)) {
      await interaction.deferUpdate();
      await this.createTicketFromDraft(interaction, draft, product);
      this.drafts.clear(userId);
      return;
    }

    await this.replyWithWizard(interaction, draft, "update");
  }

  public async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (interaction.customId.startsWith(`${CUSTOM_IDS.proofLinkModal}:`)) {
      await this.handleProofLinkModal(interaction);
      return;
    }

    if (interaction.customId !== CUSTOM_IDS.rangeModal) {
      return;
    }

    const currentValue = interaction.fields.getTextInputValue("current").trim();
    const desiredValue = interaction.fields.getTextInputValue("desired").trim();
    const draft = this.drafts.patch(interaction.user.id, { currentValue, desiredValue });
    const product = draft.productId ? findProduct(CATALOG, draft.productId) : undefined;
    if (!product) {
      throw new Error("Select a product before entering values.");
    }

    if (isDraftComplete(product, draft)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await this.createTicketFromDraft(interaction, draft, product);
      this.drafts.clear(interaction.user.id);
      return;
    }

    const payload = this.buildWizardReplyPayload(draft, product);
    await interaction.reply({ flags: MessageFlags.Ephemeral, ...payload });
  }

  public async handleMessage(message: Message): Promise<void> {
    if (!message.inGuild() || message.author.bot || message.attachments.size === 0) {
      return;
    }

    const order = this.repository.getByTicketChannelId(message.channelId);
    if (!order || order.status !== "IN_PROGRESS") {
      return;
    }

    const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member || !canCompleteOrder(member, order, this.config)) {
      return;
    }

    const proofAttachment = this.findFirstImageAttachment(message);
    if (proofAttachment) {
      if (order.assignedBoosterId === message.author.id) {
        await this.saveProofUrl(order, message.guild, proofAttachment.url, new Date(message.createdTimestamp).toISOString(), message.author.id, "attachment");
      }
      return;
    }

    await message.reply({
      content: `Unsupported attachment. Please upload a ${SUPPORTED_PROOF_IMAGE_TYPES} image.`,
      allowedMentions: { repliedUser: false },
    });
  }

  private async handleOpenProofLinkModal(interaction: ButtonInteraction): Promise<void> {
    const member = this.getMember(interaction);
    const orderId = interaction.customId.split(":")[2];
    const order = this.repository.getById(orderId);
    if (!order) {
      throw new Error("That order no longer exists.");
    }

    if (!canCompleteOrder(member, order, this.config)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only the assigned booster or staff can submit a proof link." });
      return;
    }

    if (order.status !== "IN_PROGRESS") {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Proof links can only be submitted while the order is in progress." });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`${CUSTOM_IDS.proofLinkModal}:${orderId}`)
      .setTitle("Submit Proof Link");

    const proofUrlInput = new TextInputBuilder()
      .setCustomId("proof_url")
      .setLabel("Proof image URL")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("https://cdn.discordapp.com/attachments/.../proof.png")
      .setValue(order.proofAttachmentUrl ?? "");

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(proofUrlInput));
    await interaction.showModal(modal);
  }

  private buildWizardReplyPayload(draft: DraftSelection, product?: ProductConfig) {
    const preview = product && isDraftComplete(product, draft) ? quoteOrder(product, draft, this.config.eurToUsdRate) : undefined;
    const payload = buildWizardPayload(this.config, draft, product, preview);
    return {
      embeds: payload.embeds,
      files: payload.files,
      components: buildWizardRows(CATALOG, draft),
    };
  }

  private async replyWithWizard(
    interaction: ButtonInteraction | StringSelectMenuInteraction | ChatInputCommandInteraction,
    draft: DraftSelection,
    mode: "reply" | "update",
  ): Promise<void> {
    const product = draft.productId ? findProduct(CATALOG, draft.productId) : undefined;
    const payload = this.buildWizardReplyPayload(draft, product);

    if (mode === "reply") {
      await (interaction as any).reply({ flags: MessageFlags.Ephemeral, ...payload });
    } else {
      await (interaction as any).update(payload);
    }
  }

  private async createTicketFromDraft(
    interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
    draft: DraftSelection,
    product: ProductConfig,
  ): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      throw new Error("Orders can only be created inside a guild.");
    }

    const quote = quoteOrder(product, draft, this.config.eurToUsdRate);
    const orderId = createOrderId();
    const channelName = buildTicketChannelName(product.id, interaction.user.username);
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: this.config.boostTicketCategoryId,
      topic: `Order ${orderId} | Customer ${interaction.user.id}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
        ...[this.config.supportRoleId, this.config.managerRoleId, this.config.adminRoleId].map((roleId) => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        })),
        {
          id: this.client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ],
    });

    if (ticketChannel.type !== ChannelType.GuildText) {
      throw new Error("Failed to create a text ticket channel.");
    }

    const metadata: TicketMetadata = {
      breakdown: quote.breakdown,
      promoImagePath: product.promoImagePath,
    };

    const packageValue = product.selectionMode === "package" ? quote.targetValue ?? null : null;

    const provisionalOrder: OrderRecord = {
      id: orderId,
      customerId: interaction.user.id,
      customerNameSnapshot: interaction.user.tag,
      productId: product.id,
      productLabel: product.label,
      serviceMode: quote.serviceMode,
      priceProfileId: quote.priceProfileId ?? null,
      priceProfileLabel: quote.priceProfileLabel ?? null,
      currentValue: quote.currentValue ?? null,
      desiredValue: quote.targetValue ?? null,
      packageValue,
      selectionSummary: quote.selectionSummary,
      nativeSubtotal: quote.nativeSubtotal,
      nativeTotal: quote.nativeTotal,
      nativeCurrency: quote.nativeCurrency,
      usdTotal: quote.usdTotal,
      status: "AWAITING_PAYMENT",
      ticketChannelId: ticketChannel.id,
      ticketMessageId: "",
      claimMessageId: null,
      assignedBoosterId: null,
      assignedBoosterNameSnapshot: null,
      proofAttachmentUrl: null,
      proofUpdatedAt: null,
      proofSource: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
      assignedAt: null,
      completedAt: null,
      closedAt: null,
      metadataJson: JSON.stringify(metadata),
    };

    const ticketPayload = buildTicketSummaryPayload(this.config, provisionalOrder);
    const ticketMessage = await ticketChannel.send({
      content: `<@&${this.config.supportRoleId}>`,
      allowedMentions: { roles: [this.config.supportRoleId] },
      embeds: ticketPayload.embeds,
      files: ticketPayload.files,
      components: buildTicketActionRows(provisionalOrder),
    });

    const input: NewOrderInput = {
      id: orderId,
      customerId: interaction.user.id,
      customerNameSnapshot: interaction.user.tag,
      productId: product.id,
      productLabel: product.label,
      serviceMode: quote.serviceMode,
      priceProfileId: quote.priceProfileId,
      priceProfileLabel: quote.priceProfileLabel,
      currentValue: quote.currentValue,
      desiredValue: quote.targetValue,
      packageValue: packageValue ?? undefined,
      selectionSummary: quote.selectionSummary,
      nativeSubtotal: quote.nativeSubtotal,
      nativeTotal: quote.nativeTotal,
      nativeCurrency: quote.nativeCurrency,
      usdTotal: quote.usdTotal,
      ticketChannelId: ticketChannel.id,
      ticketMessageId: ticketMessage.id,
      metadataJson: JSON.stringify(metadata),
    };

    this.repository.create(input);
    this.repository.appendAuditLog(orderId, "ORDER_CREATED", interaction.user.id, `Ticket ${ticketChannel.id} created.`);
    await this.sendAuditLog(`Order ${orderId} created`, `${interaction.user.tag} opened ${ticketChannel}.`);

    const replyPayload = {
      content: `Your ticket is ready: ${ticketChannel}`,
      embeds: [],
      components: [],
      files: [],
    };

    if (interaction.isModalSubmit()) {
      await interaction.editReply(replyPayload);
    } else {
      await interaction.editReply(replyPayload);
    }
  }

  private async handleConfirmPayment(interaction: ButtonInteraction): Promise<void> {
    const member = this.getMember(interaction);
    if (!isStaffMember(member, this.config)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only staff can confirm payment." });
      return;
    }

    const orderId = interaction.customId.split(":")[2];
    const order = this.repository.getById(orderId);
    if (!order) {
      throw new Error("That order no longer exists.");
    }

    if (order.status !== "AWAITING_PAYMENT") {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Payment has already been handled for this order." });
      return;
    }

    this.repository.markPaid(orderId);
    this.repository.appendAuditLog(orderId, "PAYMENT_CONFIRMED", interaction.user.id);
    await this.syncTicketSummary(interaction.guild!, orderId);
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Payment confirmed. Search Booster is now enabled." });

    await this.sendAuditLog(`Payment confirmed for ${orderId}`, `${interaction.user.tag} marked the order as paid.`);
  }

  private async handleSearchBooster(interaction: ButtonInteraction): Promise<void> {
    const member = this.getMember(interaction);
    if (!isStaffMember(member, this.config)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only staff can search for boosters." });
      return;
    }

    const orderId = interaction.customId.split(":")[2];
    const order = this.repository.getById(orderId);
    if (!order) {
      throw new Error("That order no longer exists.");
    }

    if (order.status !== "PAID") {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "This order is not ready for booster search." });
      return;
    }

    const claimChannel = this.getOrderChannel(interaction.guild!, this.config.claimOrdersChannelId);
    const claimMessage = await claimChannel.send({
      content: `<@&${this.config.serverBoostersRoleId}>`,
      allowedMentions: { roles: [this.config.serverBoostersRoleId] },
      embeds: [buildClaimEmbed(this.config, order)],
      components: [buildClaimActionRow(order.id)],
    });

    this.repository.markSearchingBooster(orderId, claimMessage.id);
    this.repository.appendAuditLog(orderId, "BOOSTER_SEARCH_POSTED", interaction.user.id, `Claim post ${claimMessage.id}`);
    await this.syncTicketSummary(interaction.guild!, orderId);
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: `Booster search posted in ${claimChannel}.` });

    await this.sendAuditLog(`Booster search posted for ${orderId}`, `Claim post created in ${claimChannel}.`);
  }

  private async handleAcceptBoost(interaction: ButtonInteraction): Promise<void> {
    const member = this.getMember(interaction);
    if (!isBoosterMember(member, this.config)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only boosters can claim orders." });
      return;
    }

    const orderId = interaction.customId.split(":")[2];
    const order = this.repository.getById(orderId);
    if (!order) {
      throw new Error("That order no longer exists.");
    }

    if (order.status !== "SEARCHING_BOOSTER") {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "This order is no longer available to claim." });
      return;
    }

    const assigned = this.repository.assignBooster(orderId, interaction.user.id, interaction.user.tag);
    if (!assigned) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Another booster already claimed this order." });
      return;
    }

    const updatedOrder = this.repository.getById(orderId)!;
    this.repository.appendAuditLog(orderId, "BOOSTER_ASSIGNED", interaction.user.id);

    await interaction.update({
      content: `Claimed by <@${interaction.user.id}>`,
      embeds: [buildClaimEmbed(this.config, updatedOrder)],
      components: [buildClaimActionRow(orderId, true)],
    });

    const ticketChannel = this.getOrderChannel(interaction.guild!, updatedOrder.ticketChannelId);
    await ticketChannel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });

    await this.syncTicketSummary(interaction.guild!, orderId);
    await ticketChannel.send({
      embeds: [
        buildAuditEmbed(
          this.config,
          "Booster Assigned",
          `Assigned Booster: <@${interaction.user.id}>\nStatus: In Progress\n\nUpload a proof image in this ticket as a Discord attachment, or use Submit Proof Link as a backup option, then click Complete Order.\nSupported formats: ${SUPPORTED_PROOF_IMAGE_TYPES}.`,
        ),
      ],
    });

    await this.sendAuditLog(`Booster assigned for ${orderId}`, `${interaction.user.tag} claimed the order.`);
  }

  private async handleProofLinkModal(interaction: ModalSubmitInteraction): Promise<void> {
    const member = this.getMember(interaction);
    const orderId = interaction.customId.split(":")[2];
    const order = this.repository.getById(orderId);
    if (!order) {
      throw new Error("That order no longer exists.");
    }

    if (!canCompleteOrder(member, order, this.config)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only the assigned booster or staff can submit a proof link." });
      return;
    }

    if (order.status !== "IN_PROGRESS") {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Proof links can only be submitted while the order is in progress." });
      return;
    }

    const proofUrl = interaction.fields.getTextInputValue("proof_url").trim();
    if (!isImageUrl(proofUrl)) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `Proof links must point directly to a ${SUPPORTED_PROOF_IMAGE_TYPES} image over HTTP or HTTPS.`,
      });
      return;
    }

    await this.saveProofUrl(order, interaction.guild!, proofUrl, new Date().toISOString(), interaction.user.id, "link");
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: "Proof link saved. The ticket summary now shows the backup proof image.",
    });
  }

  private async handleCompleteOrder(interaction: ButtonInteraction): Promise<void> {
    const member = this.getMember(interaction);
    const orderId = interaction.customId.split(":")[2];
    const order = this.repository.getById(orderId);
    if (!order) {
      throw new Error("That order no longer exists.");
    }

    if (!canCompleteOrder(member, order, this.config)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only the assigned booster or staff can complete this order." });
      return;
    }

    if (order.status !== "IN_PROGRESS") {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "This order is not currently in progress." });
      return;
    }

    const ticketChannel = this.getOrderChannel(interaction.guild!, order.ticketChannelId);
    const latestAttachment = await this.findLatestProofAttachment(ticketChannel, order, interaction.user.id);
    const selectedProof = this.selectProof(order, latestAttachment);
    if (!selectedProof) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: `Upload a proof image as a Discord attachment in this ticket or use Submit Proof Link before completing the order. Supported formats: ${SUPPORTED_PROOF_IMAGE_TYPES}.`,
      });
      return;
    }

    this.repository.complete(orderId, selectedProof.url, selectedProof.updatedAt, selectedProof.source);
    this.repository.appendAuditLog(orderId, "ORDER_COMPLETED", interaction.user.id, selectedProof.url);
    const updatedOrder = this.repository.getById(orderId)!;

    const completedChannel = this.getOrderChannel(interaction.guild!, this.config.completedJobsChannelId);
    await completedChannel.send({ embeds: [buildCompletedEmbed(this.config, updatedOrder)] });

    await this.syncTicketSummary(interaction.guild!, orderId);
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: `Order completed and logged in ${completedChannel}.` });

    await this.sendAuditLog(`Order completed ${orderId}`, `${interaction.user.tag} completed the order with proof.`);
  }

  private async handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
    const member = this.getMember(interaction);
    if (!isStaffMember(member, this.config)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Only staff can close tickets." });
      return;
    }

    const orderId = interaction.customId.split(":")[2];
    const order = this.repository.getById(orderId);
    if (!order) {
      throw new Error("That order no longer exists.");
    }

    if (order.status === "CLOSED") {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: "This ticket is already closed." });
      return;
    }

    this.repository.close(orderId);
    this.repository.appendAuditLog(orderId, "TICKET_CLOSED", interaction.user.id);
    const updatedOrder = this.repository.getById(orderId)!;
    const ticketChannel = this.getOrderChannel(interaction.guild!, updatedOrder.ticketChannelId);

    await ticketChannel.permissionOverwrites.edit(updatedOrder.customerId, {
      ViewChannel: false,
      SendMessages: false,
      AttachFiles: false,
    });

    if (updatedOrder.assignedBoosterId) {
      await ticketChannel.permissionOverwrites.edit(updatedOrder.assignedBoosterId, {
        ViewChannel: false,
        SendMessages: false,
        AttachFiles: false,
      });
    }

    if (!ticketChannel.name.startsWith("closed-")) {
      await ticketChannel.setName(`closed-${ticketChannel.name}`.slice(0, 95));
    }

    await this.syncTicketSummary(interaction.guild!, orderId);
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: "Ticket closed and archived for staff." });

    await this.sendAuditLog(`Ticket closed for ${orderId}`, `${interaction.user.tag} closed ${ticketChannel}.`);
  }

  public async syncTicketSummary(guild: Guild, orderId: string): Promise<void> {
    const order = this.repository.getById(orderId);
    if (!order) {
      return;
    }

    const ticketChannel = this.getOrderChannel(guild, order.ticketChannelId);
    const ticketMessage = await ticketChannel.messages.fetch(order.ticketMessageId);
    const summary = buildTicketSummaryPayload(this.config, order);

    await ticketMessage.edit({
      embeds: summary.embeds,
      files: summary.files,
      components: buildTicketActionRows(order),
    });
  }

  private getOrderChannel(guild: Guild, channelId: string): TextChannel {
    const channel = guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(`Configured channel ${channelId} is missing or not a text channel.`);
    }

    return channel;
  }

  private async findLatestProofAttachment(
    ticketChannel: TextChannel,
    order: OrderRecord,
    actorUserId: string,
  ): Promise<{ source: "attachment"; updatedAt: string; url: string } | undefined> {
    let before: string | undefined;

    while (true) {
      const batch = await ticketChannel.messages.fetch({
        limit: 100,
        ...(before ? { before } : {}),
      });
      if (batch.size === 0) {
        return undefined;
      }

      const proofMessage = [...batch.values()]
        .sort((left, right) => right.createdTimestamp - left.createdTimestamp)
        .find((message) => {
          const actorMatches = order.assignedBoosterId
            ? message.author.id === order.assignedBoosterId || message.author.id === actorUserId
            : message.author.id === actorUserId;

          return actorMatches && Boolean(this.findFirstImageAttachment(message));
        });
      const proofAttachment = proofMessage ? this.findFirstImageAttachment(proofMessage) : undefined;
      if (proofMessage && proofAttachment) {
        return {
          source: "attachment",
          updatedAt: new Date(proofMessage.createdTimestamp).toISOString(),
          url: proofAttachment.url,
        };
      }

      before = batch.last()?.id;
      if (!before) {
        return undefined;
      }
    }
  }

  private findFirstImageAttachment(message: Message) {
    return message.attachments.find((attachment) => isImageAttachment(attachment));
  }

  private async saveProofUrl(
    order: OrderRecord,
    guild: Guild,
    proofUrl: string,
    proofUpdatedAt: string,
    actorUserId: string,
    source: "attachment" | "link",
  ): Promise<void> {
    if (order.proofAttachmentUrl === proofUrl && order.proofUpdatedAt === proofUpdatedAt && order.proofSource === source) {
      return;
    }

    this.repository.updateProofAttachmentUrl(order.id, proofUrl, proofUpdatedAt, source);
    this.repository.appendAuditLog(order.id, "PROOF_UPDATED", actorUserId, `${source}: ${proofUrl}`);
    await this.syncTicketSummary(guild, order.id);
  }

  private selectProof(
    order: OrderRecord,
    latestAttachment?: { source: "attachment"; updatedAt: string; url: string },
  ): { source: "attachment" | "link"; updatedAt: string; url: string } | undefined {
    const savedProof =
      order.proofAttachmentUrl && order.proofUpdatedAt && order.proofSource
        ? {
            source: order.proofSource,
            updatedAt: order.proofUpdatedAt,
            url: order.proofAttachmentUrl,
          }
        : undefined;

    if (savedProof && latestAttachment) {
      return new Date(latestAttachment.updatedAt).getTime() > new Date(savedProof.updatedAt).getTime()
        ? latestAttachment
        : savedProof;
    }

    return latestAttachment ?? savedProof;
  }

  private getMember(interaction: any): GuildMember {
    if (!(interaction.member instanceof GuildMember)) {
      throw new Error("This interaction must be used inside a guild.");
    }

    return interaction.member;
  }

  private async sendAuditLog(title: string, description: string): Promise<void> {
    if (!this.config.auditLogChannelId) {
      return;
    }

    const guild = this.client.guilds.cache.get(this.config.guildId);
    if (!guild) {
      return;
    }

    const auditChannel = guild.channels.cache.get(this.config.auditLogChannelId);
    if (!auditChannel || auditChannel.type !== ChannelType.GuildText) {
      return;
    }

    await auditChannel.send({ embeds: [buildAuditEmbed(this.config, title, description)] });
  }
}
