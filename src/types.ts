export type Currency = "USD" | "EUR";
export type ProductType = "ranked" | "trophies" | "winstreak" | "brawler" | "prestige";
export type ServiceMode = "boost" | "carry";
export type OrderStatus =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "SEARCHING_BOOSTER"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "CANCELLED";

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
}

export interface StepPrice {
  from: string;
  to: string;
  price: number;
}

export interface RankedProfile {
  id: string;
  label: string;
  currency: Currency;
  steps: StepPrice[];
  options: SelectOption[];
  notes?: string;
}

interface BaseProductConfig {
  id: ProductType;
  label: string;
  summary: string;
  enabled: boolean;
  supportsCarry: boolean;
  promoImagePath?: string;
  panelTitle?: string;
  panelDescription?: string;
  panelButtonLabel?: string;
}

export interface RankedProductConfig extends BaseProductConfig {
  selectionMode: "ranked";
  currentLabel: string;
  targetLabel: string;
  profiles: RankedProfile[];
}

export interface TrophyBracket {
  min: number;
  max: number;
  pricePerStep: number;
}

export interface TrophyRangeProductConfig extends BaseProductConfig {
  selectionMode: "numeric_range";
  currentLabel: string;
  targetLabel: string;
  min: number;
  max: number;
  increment: number;
  currency: Currency;
  brackets: TrophyBracket[];
  helperText: string;
}

export interface BreakpointsProductConfig extends BaseProductConfig {
  selectionMode: "breakpoints";
  currentLabel: string;
  targetLabel: string;
  currency: Currency;
  options: SelectOption[];
  steps: StepPrice[];
  notes?: string;
}

export interface PackageOption {
  id: string;
  label: string;
  valueLabel: string;
  price: number;
  currency: Currency;
}

export interface PackageProductConfig extends BaseProductConfig {
  selectionMode: "package";
  optionLabel: string;
  packages: PackageOption[];
}

export type ProductConfig =
  | RankedProductConfig
  | TrophyRangeProductConfig
  | BreakpointsProductConfig
  | PackageProductConfig;

export interface CatalogConfig {
  panel: {
    title: string;
    description: string;
  };
  products: ProductConfig[];
}

export interface DraftSelection {
  userId: string;
  updatedAt: number;
  productId?: ProductType;
  serviceMode?: ServiceMode;
  profileId?: string;
  currentValue?: string;
  desiredValue?: string;
  packageValue?: string;
}

export interface PriceComputation {
  productId: ProductType;
  productLabel: string;
  serviceMode: ServiceMode;
  priceProfileId?: string;
  priceProfileLabel?: string;
  nativeSubtotal: number;
  nativeTotal: number;
  nativeCurrency: Currency;
  usdTotal: number;
  currentLabel?: string;
  currentValue?: string;
  targetLabel?: string;
  targetValue?: string;
  selectionSummary: string;
  breakdown: string[];
}

export interface OrderRecord {
  id: string;
  customerId: string;
  customerNameSnapshot: string;
  productId: ProductType;
  productLabel: string;
  serviceMode: ServiceMode;
  priceProfileId: string | null;
  priceProfileLabel: string | null;
  currentValue: string | null;
  desiredValue: string | null;
  packageValue: string | null;
  selectionSummary: string;
  nativeSubtotal: number;
  nativeTotal: number;
  nativeCurrency: Currency;
  usdTotal: number;
  status: OrderStatus;
  ticketChannelId: string;
  ticketMessageId: string;
  claimMessageId: string | null;
  assignedBoosterId: string | null;
  assignedBoosterNameSnapshot: string | null;
  proofAttachmentUrl: string | null;
  proofUpdatedAt: string | null;
  proofSource: "attachment" | "link" | null;
  createdAt: string;
  paidAt: string | null;
  assignedAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
  metadataJson: string;
}

export interface NewOrderInput {
  id: string;
  customerId: string;
  customerNameSnapshot: string;
  productId: ProductType;
  productLabel: string;
  serviceMode: ServiceMode;
  priceProfileId?: string;
  priceProfileLabel?: string;
  currentValue?: string;
  desiredValue?: string;
  packageValue?: string;
  selectionSummary: string;
  nativeSubtotal: number;
  nativeTotal: number;
  nativeCurrency: Currency;
  usdTotal: number;
  ticketChannelId: string;
  ticketMessageId: string;
  metadataJson: string;
}

export interface TicketMetadata {
  breakdown: string[];
  promoImagePath?: string;
}

export interface BotConfig {
  token: string;
  clientId: string;
  guildId: string;
  orderHereChannelId: string;
  boostTicketCategoryId: string;
  claimOrdersChannelId: string;
  completedJobsChannelId: string;
  auditLogChannelId?: string;
  supportRoleId: string;
  managerRoleId: string;
  adminRoleId: string;
  serverBoostersRoleId: string;
  eurToUsdRate: number;
  databasePath: string;
  embedFooter: string;
  rootDir: string;
}
