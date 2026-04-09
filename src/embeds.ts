import { AttachmentBuilder, EmbedBuilder, type ColorResolvable } from "discord.js";
import { basename } from "node:path";

import { resolveProductImage } from "./catalog.js";
import { formatCurrency } from "./utils.js";

import type { BotConfig, CatalogConfig, DraftSelection, OrderRecord, PriceComputation, ProductConfig, TicketMetadata } from "./types.js";

const COLORS: Record<"primary" | "success" | "warning" | "danger", ColorResolvable> = {
  primary: 0x7a2df3,
  success: 0x43b581,
  warning: 0xf1c40f,
  danger: 0xe74c3c,
};

function createBaseEmbed(config: BotConfig, color: keyof typeof COLORS): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS[color])
    .setFooter({ text: config.embedFooter })
    .setTimestamp();
}

function addIfValue(embed: EmbedBuilder, name: string, value: string | null | undefined, inline = true): void {
  if (value && value.trim().length > 0) {
    embed.addFields({ name, value, inline });
  }
}

function statusLabel(status: OrderRecord["status"]): string {
  switch (status) {
    case "AWAITING_PAYMENT":
      return "Awaiting Payment";
    case "PAID":
      return "Paid";
    case "SEARCHING_BOOSTER":
      return "Searching Booster";
    case "IN_PROGRESS":
      return "In Progress";
    case "COMPLETED":
      return "Completed";
    case "CLOSED":
      return "Closed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function buildOrderPanelPayload(
  config: BotConfig,
  product: ProductConfig,
): { embeds: EmbedBuilder[]; files: AttachmentBuilder[] } {
  const embed = createBaseEmbed(config, "primary")
    .setTitle(product.panelTitle ?? `${product.label} Order Panel`)
    .setDescription(product.panelDescription ?? product.summary);

  const imagePath = resolveProductImage(config.rootDir, product);
  if (!imagePath) {
    return { embeds: [embed], files: [] };
  }

  const fileName = basename(imagePath);
  embed.setImage(`attachment://${fileName}`);
  return {
    embeds: [embed],
    files: [new AttachmentBuilder(imagePath, { name: fileName })],
  };
}

export function buildWizardPayload(
  config: BotConfig,
  draft: DraftSelection,
  product?: ProductConfig,
  pricingPreview?: PriceComputation,
): { embeds: EmbedBuilder[]; files: AttachmentBuilder[] } {
  const embed = createBaseEmbed(config, "primary")
    .setTitle("Create Your Order")
    .setDescription("Choose your product, service type, and required details. The ticket opens automatically when the selection is valid.");

  addIfValue(embed, "Product", product?.label);
  addIfValue(embed, "Service", draft.serviceMode ? (draft.serviceMode === "carry" ? "Carry" : "Boost") : undefined);
  addIfValue(embed, "Profile", pricingPreview?.priceProfileLabel);
  addIfValue(embed, "Current", pricingPreview?.currentValue ?? draft.currentValue);
  addIfValue(embed, "Desired", pricingPreview?.targetValue ?? draft.desiredValue);
  addIfValue(embed, "Package", draft.packageValue);

  if (pricingPreview) {
    embed.addFields(
      { name: "Selection", value: pricingPreview.selectionSummary, inline: false },
      { name: "Native Total", value: formatCurrency(pricingPreview.nativeTotal, pricingPreview.nativeCurrency), inline: true },
      { name: "USD Total", value: formatCurrency(pricingPreview.usdTotal, "USD"), inline: true },
    );
  }

  const imagePath = product ? resolveProductImage(config.rootDir, product) : undefined;
  if (!imagePath) {
    return { embeds: [embed], files: [] };
  }

  const fileName = basename(imagePath);
  embed.setImage(`attachment://${fileName}`);
  return {
    embeds: [embed],
    files: [new AttachmentBuilder(imagePath, { name: fileName })],
  };
}

function buildOrderSummaryEmbed(
  config: BotConfig,
  order: OrderRecord,
  metadata: TicketMetadata,
): { embed: EmbedBuilder; files: AttachmentBuilder[] } {
  const embed = createBaseEmbed(
    config,
    order.status === "COMPLETED"
      ? "success"
      : order.status === "AWAITING_PAYMENT"
        ? "warning"
        : order.status === "CANCELLED"
          ? "danger"
          : "primary",
  )
    .setTitle(`${order.productLabel} Order`)
    .setDescription(`Order ID: \`${order.id}\``)
    .addFields(
      { name: "Customer", value: `<@${order.customerId}>`, inline: true },
      { name: "Service", value: order.serviceMode === "carry" ? "Carry" : "Boost", inline: true },
      { name: "Status", value: statusLabel(order.status), inline: true },
      { name: "Selection", value: order.selectionSummary, inline: false },
      { name: "Native Total", value: formatCurrency(order.nativeTotal, order.nativeCurrency), inline: true },
      { name: "USD Total", value: formatCurrency(order.usdTotal, "USD"), inline: true },
    );

  addIfValue(embed, "Profile", order.priceProfileLabel);
  addIfValue(embed, "Assigned Booster", order.assignedBoosterId ? `<@${order.assignedBoosterId}>` : undefined);
  addIfValue(embed, "Proof", order.proofAttachmentUrl ? "Image attached below." : undefined, false);

  if (metadata.breakdown.length > 0) {
    embed.addFields({
      name: "Price Breakdown",
      value: metadata.breakdown.slice(0, 8).map((line) => `- ${line}`).join("\n"),
      inline: false,
    });
  }

  const files: AttachmentBuilder[] = [];
  if (order.proofAttachmentUrl) {
    embed.setImage(order.proofAttachmentUrl);
  } else if (metadata.promoImagePath) {
    const imagePath = resolveProductImage(config.rootDir, {
      id: order.productId,
      label: order.productLabel,
      summary: "",
      enabled: true,
      supportsCarry: true,
      selectionMode: "package",
      promoImagePath: metadata.promoImagePath,
      optionLabel: "",
      packages: [],
    });

    if (imagePath) {
      const fileName = basename(imagePath);
      files.push(new AttachmentBuilder(imagePath, { name: fileName }));
      embed.setImage(`attachment://${fileName}`);
    }
  }

  return { embed, files };
}

export function buildTicketSummaryPayload(config: BotConfig, order: OrderRecord): { embeds: EmbedBuilder[]; files: AttachmentBuilder[] } {
  const metadata = JSON.parse(order.metadataJson) as TicketMetadata;
  const { embed, files } = buildOrderSummaryEmbed(config, order, metadata);
  return { embeds: [embed], files };
}

export function buildClaimEmbed(config: BotConfig, order: OrderRecord): EmbedBuilder {
  return createBaseEmbed(config, "primary")
    .setTitle("Booster Needed")
    .setDescription(`A paid ${order.productLabel.toLowerCase()} order is ready to claim.`)
    .addFields(
      { name: "Customer", value: `<@${order.customerId}>`, inline: true },
      { name: "Service", value: order.serviceMode === "carry" ? "Carry" : "Boost", inline: true },
      { name: "Selection", value: order.selectionSummary, inline: false },
      { name: "USD Total", value: formatCurrency(order.usdTotal, "USD"), inline: true },
      { name: "Ticket", value: `<#${order.ticketChannelId}>`, inline: true },
    );
}

export function buildCompletedEmbed(config: BotConfig, order: OrderRecord): EmbedBuilder {
  const embed = createBaseEmbed(config, "success")
    .setTitle("Order Completed")
    .addFields(
      { name: "Customer", value: `<@${order.customerId}>`, inline: true },
      { name: "Booster", value: order.assignedBoosterId ? `<@${order.assignedBoosterId}>` : "Unassigned", inline: true },
      { name: "Service", value: `${order.productLabel} / ${order.serviceMode === "carry" ? "Carry" : "Boost"}`, inline: true },
      { name: "Starting", value: order.currentValue ?? "N/A", inline: true },
      { name: "Final", value: order.desiredValue ?? order.packageValue ?? "N/A", inline: true },
      { name: "Total Price", value: formatCurrency(order.usdTotal, "USD"), inline: true },
      { name: "Status", value: "Completed", inline: true },
    );

  if (order.proofAttachmentUrl) {
    embed.addFields({ name: "Proof", value: "Image attached below.", inline: false });
    embed.setImage(order.proofAttachmentUrl);
  }

  return embed;
}

export function buildAuditEmbed(config: BotConfig, title: string, description: string): EmbedBuilder {
  return createBaseEmbed(config, "primary").setTitle(title).setDescription(description);
}
