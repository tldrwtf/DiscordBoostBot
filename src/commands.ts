import {
  ApplicationIntegrationType,
  ChannelType,
  ContextMenuCommandBuilder,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  ApplicationCommandType,
} from "discord.js";

import { CATALOG } from "./catalog.js";

const productChoices = CATALOG.products
  .filter((product) => product.enabled)
  .map((product) => ({ name: product.label, value: product.id }));

export const commands = [
  new SlashCommandBuilder()
    .setName("deploy-order-panel")
    .setDescription("Post a product-specific order panel in a text channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .addStringOption((option) =>
      option
        .setName("service")
        .setDescription("The product panel to post.")
        .setRequired(true)
        .addChoices(...productChoices),
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to post the panel in. Defaults to the current channel.")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .toJSON(),

  new ContextMenuCommandBuilder()
    .setName("Manage Order")
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("order")
    .setDescription("Start a boosting order for a specific service.")
    .setContexts(InteractionContextType.Guild)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
    .addStringOption((option) =>
      option
        .setName("service")
        .setDescription("The service you want to purchase.")
        .setRequired(true)
        .addChoices(...productChoices),
    )
    .toJSON(),
];
