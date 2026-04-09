import path from "node:path";

import type {
  BreakpointsProductConfig,
  CatalogConfig,
  ProductConfig,
  ProductType,
  RankedProductConfig,
  RankedProfile,
  SelectOption,
} from "./types.js";

function promo(fileName: string): string {
  return path.join("promo_images", fileName);
}

function numericOptions(values: number[]): SelectOption[] {
  return values.map((value) => ({
    label: value.toLocaleString("en-US"),
    value: String(value),
  }));
}

const ranked: RankedProductConfig = {
  id: "ranked",
  selectionMode: "ranked",
  label: "Ranked",
  summary: "Queue-based ranked progression with explicit Diamond, Mythic, and Pro pricing profiles.",
  enabled: true,
  supportsCarry: true,
  promoImagePath: promo("7D2B45BD-DAAD-4199-A806-99980699BAF2.png"),
  panelTitle: "Ranked BO0st Service",
  panelDescription:
    "**What We Offer**\n- Queue-based ranked progression with profile-based pricing\n- Private ticket handling from payment to completion\n- Booster assignment and proof-based completion tracking\n\n**Ranked Pricing**\n- Diamond 1 → Diamond 2 = €3\n- Diamond 2 → Diamond 3 = €3\n- Diamond 3 → Mythic 1 = €3",
  panelButtonLabel: "Get Your Rank Boosted",
  currentLabel: "Current rank",
  targetLabel: "Desired rank",
  profiles: [
    {
      id: "low-rank",
      label: "Diamond to Mythic",
      currency: "EUR",
      steps: [
        { from: "diamond1", to: "diamond2", price: 3 },
        { from: "diamond2", to: "diamond3", price: 3 },
        { from: "diamond3", to: "mythic1", price: 3 },
      ],
      options: [
        { label: "Diamond 1", value: "diamond1" },
        { label: "Diamond 2", value: "diamond2" },
        { label: "Diamond 3", value: "diamond3" },
        { label: "Mythic 1", value: "mythic1" },
      ],
    },
    {
      id: "high-rank",
      label: "Mythic to Pro",
      currency: "EUR",
      steps: [
        { from: "m1_high", to: "m2_high", price: 35 },
        { from: "m2_high", to: "m3_high", price: 70 },
        { from: "m3_high", to: "pro", price: 135 },
      ],
      options: [
        { label: "Mythic 1", value: "m1_high" },
        { label: "Mythic 2", value: "m2_high" },
        { label: "Mythic 3", value: "m3_high" },
        { label: "Pro", value: "pro" },
      ],
      notes: "Mythic 3 to Pro pricing may vary depending on unlocked brawlers.",
    },
  ],
};

const trophies: ProductConfig = {
  id: "trophies",
  selectionMode: "numeric_range",
  label: "Trophies",
  summary: "Per-1K trophy pushing from 0 to 150K, billed by the current trophy bracket.",
  enabled: true,
  supportsCarry: true,
  promoImagePath: promo("90C926B8-3B6F-4B2A-89EE-5CEC1E250336.png"),
  panelTitle: "Trophy BO0st Service",
  panelDescription:
    "**What We Offer**\n- Trophy pushing across the configured bracket range\n- Clean pricing inside the order flow based on your start point\n- Private ticket workflow with staff confirmation and proof logging",
  panelButtonLabel: "Get Your Trophies Boosted",
  currentLabel: "Current trophies",
  targetLabel: "Desired trophies",
  min: 0,
  max: 150000,
  increment: 1000,
  currency: "USD",
  helperText: "Enter whole trophy values in 1,000-point increments only.",
  brackets: [
    { min: 0, max: 10000, pricePerStep: 6 },
    { min: 10000, max: 20000, pricePerStep: 8 },
    { min: 20000, max: 30000, pricePerStep: 12 },
    { min: 30000, max: 40000, pricePerStep: 14 },
    { min: 40000, max: 50000, pricePerStep: 15 },
    { min: 50000, max: 60000, pricePerStep: 16 },
    { min: 60000, max: 70000, pricePerStep: 20 },
    { min: 70000, max: 80000, pricePerStep: 22 },
    { min: 80000, max: 90000, pricePerStep: 24 },
    { min: 90000, max: 100000, pricePerStep: 30 },
    { min: 100000, max: 125000, pricePerStep: 36 },
    { min: 125000, max: 150000, pricePerStep: 40 },
  ],
};

const brawler: BreakpointsProductConfig = {
  id: "brawler",
  selectionMode: "breakpoints",
  label: "Brawler",
  summary: "BM-style per-brawler trophy pushing using the exact supplied milestone chart.",
  enabled: true,
  supportsCarry: true,
  promoImagePath: promo("9B375BEF-F48F-4921-9F75-1D32DFA0AF93.png"),
  panelTitle: "Brawler BO0st Service",
  panelDescription:
    "**What We Offer**\n- Level up your brawlers to their maximum potential\n- Professional service with guaranteed results\n- Rank up any brawler quickly and efficiently",
  panelButtonLabel: "Get Your Brawler Ranked Up",
  currentLabel: "Current brawler trophies",
  targetLabel: "Desired brawler trophies",
  currency: "USD",
  options: numericOptions([0, 750, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000]),
  steps: [
    { from: "0", to: "750", price: 11.25 },
    { from: "750", to: "900", price: 5 },
    { from: "900", to: "1000", price: 2.3 },
    { from: "1000", to: "1100", price: 4 },
    { from: "1100", to: "1200", price: 4.5 },
    { from: "1200", to: "1300", price: 5 },
    { from: "1300", to: "1400", price: 5.5 },
    { from: "1400", to: "1500", price: 7.5 },
    { from: "1500", to: "1600", price: 7.5 },
    { from: "1600", to: "1700", price: 8.5 },
    { from: "1700", to: "1800", price: 10.5 },
    { from: "1800", to: "1900", price: 12.5 },
    { from: "1900", to: "2000", price: 13.5 },
  ],
  notes: "Only exact configured breakpoints are accepted. Gaps in the chart stay unavailable.",
};

const prestige: BreakpointsProductConfig = {
  id: "prestige",
  selectionMode: "breakpoints",
  label: "Prestige",
  summary: "Prestige ladder progression with euro-based step pricing.",
  enabled: true,
  supportsCarry: true,
  promoImagePath: promo("B78A548C-F152-433C-A7E0-ECD2D40A328A.png"),
  panelTitle: "Prestige BO0st Service",
  panelDescription:
    "**What We Offer**\n- Prestige ladder progression through the configured stages\n- Ticket-based handling with clear selection validation\n- Completion proof and closed-loop staff workflow",
  panelButtonLabel: "Get Your Prestige Boosted",
  currentLabel: "Current prestige",
  targetLabel: "Desired prestige",
  currency: "EUR",
  options: [
    { label: "I", value: "I" },
    { label: "II", value: "II" },
    { label: "III", value: "III" },
  ],
  steps: [
    { from: "I", to: "II", price: 30 },
    { from: "II", to: "III", price: 77 },
  ],
};

const winstreak: ProductConfig = {
  id: "winstreak",
  selectionMode: "package",
  label: "Winstreak",
  summary: "Fixed-price winstreak packages from the provided pricing card.",
  enabled: true,
  supportsCarry: true,
  promoImagePath: promo("17232F8E-094A-42D9-994F-AD59F8A79AA5.png"),
  panelTitle: "Winstreak BO0st Service",
  panelDescription:
    "**What We Offer**\n- Fixed winstreak packages with direct package selection\n- Private ticket support from claim to completion\n- Proof-logged delivery after booster assignment",
  panelButtonLabel: "Start Your Winstreak Order",
  optionLabel: "Target winstreak",
  packages: [
    { id: "50", label: "50 wins", valueLabel: "50 wins", price: 23, currency: "USD" },
    { id: "69", label: "69 wins", valueLabel: "69 wins", price: 33, currency: "USD" },
    { id: "101", label: "101 wins", valueLabel: "101 wins", price: 51, currency: "USD" },
    { id: "111", label: "111 wins", valueLabel: "111 wins", price: 63, currency: "USD" },
    { id: "125", label: "125 wins", valueLabel: "125 wins", price: 77, currency: "USD" },
    { id: "200", label: "200 wins", valueLabel: "200 wins", price: 115, currency: "USD" },
  ],
};

export const CATALOG: CatalogConfig = {
  panel: {
    title: "Elite Boosters Order Hub",
    description: "Start a private ticket, pick your service, and the bot will route the order from payment to completion.",
  },
  products: [ranked, trophies, brawler, prestige, winstreak],
};

export function findProduct(catalog: CatalogConfig, productId: ProductType): ProductConfig | undefined {
  return catalog.products.find((product) => product.id === productId);
}

export function findRankedProfile(product: RankedProductConfig, profileId?: string): RankedProfile | undefined {
  if (!profileId) {
    return product.profiles[0];
  }

  return product.profiles.find((profile) => profile.id === profileId) ?? product.profiles[0];
}

export function findOptionLabel(options: SelectOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function resolveProductImage(rootDir: string, product: ProductConfig): string | undefined {
  if (!product.promoImagePath) {
    return undefined;
  }

  return path.resolve(rootDir, product.promoImagePath);
}
