import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type APISelectMenuOption,
} from "discord.js";

import { findProduct, findRankedProfile } from "./catalog.js";

import type { CatalogConfig, DraftSelection, OrderRecord, ProductConfig, ServiceMode } from "./types.js";

export const CUSTOM_IDS = {
  getBoosted: "panel:get-boosted",
  productSelect: "wizard:product",
  serviceSelect: "wizard:service",
  profileSelect: "wizard:profile",
  currentSelect: "wizard:current",
  desiredSelect: "wizard:desired",
  packageSelect: "wizard:package",
  openRangeModal: "wizard:open-range",
  rangeModal: "wizard:range-modal",
  confirmPayment: "ticket:confirm-payment",
  searchBooster: "ticket:search-booster",
  submitProofLink: "ticket:submit-proof-link",
  proofLinkModal: "ticket:proof-link-modal",
  completeOrder: "ticket:complete",
  closeTicket: "ticket:close",
  acceptBoost: "claim:accept",
} as const;

function serviceOptions(product?: ProductConfig): APISelectMenuOption[] {
  const options: APISelectMenuOption[] = [
    {
      label: "Boost",
      value: "boost",
      description: "Standard pricing.",
    },
  ];

  if (product?.supportsCarry ?? true) {
    options.push({
      label: "Carry",
      value: "carry",
      description: "Carry orders are charged at 2x.",
    });
  }

  return options;
}

export function buildPanelButtonRow(product: ProductConfig): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_IDS.getBoosted}:${product.id}`)
      .setLabel(product.panelButtonLabel ?? `Order ${product.label}`)
      .setStyle(ButtonStyle.Primary),
  );
}

export function buildWizardRows(
  catalog: CatalogConfig,
  draft: DraftSelection,
): Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> {
  const product = draft.productId ? findProduct(catalog, draft.productId) : undefined;
  const rows: Array<ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>> = [];

  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.productSelect)
        .setPlaceholder("Select a product")
        .addOptions(
          catalog.products
            .filter((entry) => entry.enabled)
            .map((entry) => ({
              label: entry.label,
              value: entry.id,
              description: entry.summary.slice(0, 100),
              default: draft.productId === entry.id,
            })),
        ),
    ),
  );

  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(CUSTOM_IDS.serviceSelect)
        .setPlaceholder("Select Boost or Carry")
        .setDisabled(!product)
        .addOptions(
          serviceOptions(product).map((option) => ({
            ...option,
            default: draft.serviceMode === option.value,
          })),
        ),
    ),
  );

  if (!product) {
    return rows;
  }

  if (product.selectionMode === "ranked" && product.profiles.length > 1) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(CUSTOM_IDS.profileSelect)
          .setPlaceholder("Select a ranked profile")
          .addOptions(
            product.profiles.map((profile) => ({
              label: profile.label,
              value: profile.id,
              description: profile.notes?.slice(0, 100) ?? undefined,
              default: draft.profileId === profile.id,
            })),
          ),
      ),
    );
  }

  switch (product.selectionMode) {
    case "ranked": {
      const profile = findRankedProfile(product, draft.profileId);
      const rankOptions = (profile?.options ?? []).map((option) => ({
        label: option.label,
        value: option.value,
        description: option.description,
      }));
      const currentOptions =
        profile && profile.options.length > 1 ? rankOptions.slice(0, Math.max(rankOptions.length - 1, 1)) : rankOptions;

      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(CUSTOM_IDS.currentSelect)
            .setPlaceholder("Select current rank")
            .setDisabled(!profile)
            .addOptions(
              currentOptions.map((option) => ({
                ...option,
                default: draft.currentValue === option.value,
              })),
            ),
        ),
      );

      const currentIndex = rankOptions.findIndex((option) => option.value === draft.currentValue);
      const desiredOptions = currentIndex >= 0 ? rankOptions.slice(currentIndex + 1) : rankOptions;

      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(CUSTOM_IDS.desiredSelect)
            .setPlaceholder("Select desired rank")
            .setDisabled(!profile)
            .addOptions(
              desiredOptions.map((option) => ({
                ...option,
                default: draft.desiredValue === option.value,
              })),
            ),
        ),
      );
      break;
    }
    case "breakpoints": {
      const currentOptions = product.options.length > 1 ? product.options.slice(0, Math.max(product.options.length - 1, 1)) : product.options;
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(CUSTOM_IDS.currentSelect)
            .setPlaceholder(`Select ${product.currentLabel.toLowerCase()}`)
            .addOptions(
              currentOptions.map((option) => ({
                ...option,
                default: draft.currentValue === option.value,
              })),
            ),
        ),
      );

      const currentIndex = product.options.findIndex((option) => option.value === draft.currentValue);
      const desiredOptions = currentIndex >= 0 ? product.options.slice(currentIndex + 1) : product.options;
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(CUSTOM_IDS.desiredSelect)
            .setPlaceholder(`Select ${product.targetLabel.toLowerCase()}`)
            .addOptions(
              desiredOptions.map((option) => ({
                ...option,
                default: draft.desiredValue === option.value,
              })),
            ),
        ),
      );
      break;
    }
    case "package": {
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(CUSTOM_IDS.packageSelect)
            .setPlaceholder(`Select ${product.optionLabel.toLowerCase()}`)
            .addOptions(
              product.packages.map((pkg) => ({
                label: pkg.label,
                value: pkg.id,
                description: `${pkg.price} ${pkg.currency}`,
                default: draft.packageValue === pkg.id,
              })),
            ),
        ),
      );
      break;
    }
    case "numeric_range": {
      rows.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(CUSTOM_IDS.openRangeModal)
            .setLabel(draft.currentValue && draft.desiredValue ? "Edit Values" : "Enter Values")
            .setStyle(ButtonStyle.Secondary),
        ),
      );
      break;
    }
  }

  return rows;
}

export function isDraftComplete(product: ProductConfig | undefined, draft: DraftSelection): boolean {
  if (!product || !draft.serviceMode) {
    return false;
  }

  if (product.selectionMode === "ranked") {
    const needsProfile = product.profiles.length > 1;
    return (!needsProfile || Boolean(draft.profileId)) && Boolean(draft.currentValue) && Boolean(draft.desiredValue);
  }

  if (product.selectionMode === "numeric_range" || product.selectionMode === "breakpoints") {
    return Boolean(draft.currentValue) && Boolean(draft.desiredValue);
  }

  return Boolean(draft.packageValue);
}

export function buildTicketActionRows(order: OrderRecord): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.confirmPayment}:${order.id}`)
        .setLabel("Confirm Payment")
        .setStyle(ButtonStyle.Success)
        .setDisabled(order.status !== "AWAITING_PAYMENT"),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.searchBooster}:${order.id}`)
        .setLabel("Search Booster")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(order.status !== "PAID"),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.completeOrder}:${order.id}`)
        .setLabel("Complete Order")
        .setStyle(ButtonStyle.Success)
        .setDisabled(order.status !== "IN_PROGRESS"),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.submitProofLink}:${order.id}`)
        .setLabel("Submit Proof Link")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(order.status !== "IN_PROGRESS"),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_IDS.closeTicket}:${order.id}`)
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(order.status === "CLOSED"),
    ),
  ];
}

export function buildClaimActionRow(orderId: string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_IDS.acceptBoost}:${orderId}`)
      .setLabel("Accept Boost")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

export function normalizeServiceMode(value: string): ServiceMode {
  return value === "carry" ? "carry" : "boost";
}
