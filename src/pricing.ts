import { findOptionLabel, findRankedProfile } from "./catalog.js";
import { formatCurrency, roundMoney } from "./utils.js";

import type {
  BreakpointsProductConfig,
  DraftSelection,
  PackageProductConfig,
  PriceComputation,
  ProductConfig,
  RankedProductConfig,
  ServiceMode,
  TrophyRangeProductConfig,
} from "./types.js";

function multiplierForService(serviceMode: ServiceMode): number {
  return serviceMode === "carry" ? 2 : 1;
}

function buildLinkedStepsBreakdown(
  steps: ReadonlyArray<{ from: string; to: string; price: number }>,
  currentValue: string,
  desiredValue: string,
): { selectedSteps: Array<{ from: string; to: string; price: number }>; subtotal: number } {
  if (currentValue === desiredValue) {
    throw new Error("Desired value must be above the current value.");
  }

  const stepMap = new Map(steps.map((step) => [step.from, step]));
  const selectedSteps: Array<{ from: string; to: string; price: number }> = [];
  const visited = new Set<string>([currentValue]);
  let subtotal = 0;
  let cursor = currentValue;

  while (cursor !== desiredValue) {
    const step = stepMap.get(cursor);
    if (!step) {
      throw new Error(`No configured price step from ${cursor}.`);
    }

    subtotal += step.price;
    selectedSteps.push(step);
    cursor = step.to;

    if (visited.has(cursor) && cursor !== desiredValue) {
      throw new Error(`Could not reach ${desiredValue} from ${currentValue}.`);
    }

    visited.add(cursor);
  }

  return { selectedSteps, subtotal: roundMoney(subtotal) };
}

function quoteRanked(product: RankedProductConfig, session: DraftSelection): Omit<PriceComputation, "nativeTotal" | "usdTotal" | "serviceMode"> {
  if (!session.currentValue || !session.desiredValue) {
    throw new Error(`${product.label} requires both current and target values.`);
  }

  const profile = findRankedProfile(product, session.profileId);
  if (!profile) {
    throw new Error("No ranked profile is configured.");
  }

  const { subtotal, selectedSteps } = buildLinkedStepsBreakdown(profile.steps, session.currentValue, session.desiredValue);
  const breakdown = selectedSteps.map(
    (step) =>
      `${findOptionLabel(profile.options, step.from)} -> ${findOptionLabel(profile.options, step.to)}: ${formatCurrency(step.price, profile.currency)}`,
  );

  return {
    productId: product.id,
    productLabel: product.label,
    priceProfileId: profile.id,
    priceProfileLabel: profile.label,
    nativeSubtotal: subtotal,
    nativeCurrency: profile.currency,
    currentLabel: product.currentLabel,
    currentValue: findOptionLabel(profile.options, session.currentValue),
    targetLabel: product.targetLabel,
    targetValue: findOptionLabel(profile.options, session.desiredValue),
    selectionSummary: `${findOptionLabel(profile.options, session.currentValue)} -> ${findOptionLabel(profile.options, session.desiredValue)}`,
    breakdown: profile.notes ? [...breakdown, profile.notes] : breakdown,
  };
}

function quoteBreakpoints(product: BreakpointsProductConfig, session: DraftSelection): Omit<PriceComputation, "nativeTotal" | "usdTotal" | "serviceMode"> {
  if (!session.currentValue || !session.desiredValue) {
    throw new Error(`${product.label} requires both current and target values.`);
  }

  const { subtotal, selectedSteps } = buildLinkedStepsBreakdown(product.steps, session.currentValue, session.desiredValue);
  const breakdown = selectedSteps.map(
    (step) => `${findOptionLabel(product.options, step.from)} -> ${findOptionLabel(product.options, step.to)}: ${step.price}`,
  );

  return {
    productId: product.id,
    productLabel: product.label,
    nativeSubtotal: subtotal,
    nativeCurrency: product.currency,
    currentLabel: product.currentLabel,
    currentValue: findOptionLabel(product.options, session.currentValue),
    targetLabel: product.targetLabel,
    targetValue: findOptionLabel(product.options, session.desiredValue),
    selectionSummary: `${findOptionLabel(product.options, session.currentValue)} -> ${findOptionLabel(product.options, session.desiredValue)}`,
    breakdown: product.notes ? [...breakdown, product.notes] : breakdown,
  };
}

function quoteTrophies(product: TrophyRangeProductConfig, session: DraftSelection): Omit<PriceComputation, "nativeTotal" | "usdTotal" | "serviceMode"> {
  if (!session.currentValue || !session.desiredValue) {
    throw new Error(`${product.label} requires both current and target values.`);
  }

  const current = Number(session.currentValue);
  const desired = Number(session.desiredValue);
  if (!Number.isInteger(current) || !Number.isInteger(desired)) {
    throw new Error("Trophy values must be whole numbers.");
  }

  if (desired <= current) {
    throw new Error("Desired trophies must be above the current amount.");
  }

  if (current < product.min || desired > product.max) {
    throw new Error(`Trophy values must stay between ${product.min} and ${product.max}.`);
  }

  if (current % product.increment !== 0 || desired % product.increment !== 0) {
    throw new Error(`Trophy values must be multiples of ${product.increment}.`);
  }

  let subtotal = 0;
  const breakdown: string[] = [];
  for (let pointer = current; pointer < desired; pointer += product.increment) {
    const bracket = product.brackets.find((candidate) => pointer >= candidate.min && pointer < candidate.max);
    if (!bracket) {
      throw new Error(`No bracket is configured for ${pointer}.`);
    }

    subtotal += bracket.pricePerStep;
    breakdown.push(`${pointer.toLocaleString("en-US")} -> ${(pointer + product.increment).toLocaleString("en-US")}: ${bracket.pricePerStep}`);
  }

  return {
    productId: product.id,
    productLabel: product.label,
    nativeSubtotal: roundMoney(subtotal),
    nativeCurrency: product.currency,
    currentLabel: product.currentLabel,
    currentValue: current.toLocaleString("en-US"),
    targetLabel: product.targetLabel,
    targetValue: desired.toLocaleString("en-US"),
    selectionSummary: `${current.toLocaleString("en-US")} -> ${desired.toLocaleString("en-US")}`,
    breakdown,
  };
}

function quotePackage(product: PackageProductConfig, session: DraftSelection): Omit<PriceComputation, "nativeTotal" | "usdTotal" | "serviceMode"> {
  const selectedPackage = product.packages.find((pkg) => pkg.id === session.packageValue);
  if (!selectedPackage) {
    throw new Error(`Select a valid ${product.optionLabel.toLowerCase()}.`);
  }

  return {
    productId: product.id,
    productLabel: product.label,
    nativeSubtotal: roundMoney(selectedPackage.price),
    nativeCurrency: selectedPackage.currency,
    targetLabel: product.optionLabel,
    targetValue: selectedPackage.valueLabel,
    selectionSummary: selectedPackage.valueLabel,
    breakdown: [`${selectedPackage.label}: ${selectedPackage.price}`],
  };
}

export function quoteOrder(product: ProductConfig, session: DraftSelection, eurToUsdRate: number): PriceComputation {
  if (!session.serviceMode) {
    throw new Error("Select a service type before creating an order.");
  }

  if (!product.enabled) {
    throw new Error(`${product.label} is currently disabled.`);
  }

  const base =
    product.selectionMode === "ranked"
      ? quoteRanked(product, session)
      : product.selectionMode === "numeric_range"
        ? quoteTrophies(product, session)
        : product.selectionMode === "breakpoints"
          ? quoteBreakpoints(product, session)
          : quotePackage(product, session);

  const nativeTotal = roundMoney(base.nativeSubtotal * multiplierForService(session.serviceMode));
  const usdTotal =
    base.nativeCurrency === "USD" ? nativeTotal : roundMoney(nativeTotal * eurToUsdRate);

  return {
    ...base,
    serviceMode: session.serviceMode,
    nativeTotal,
    usdTotal,
    breakdown:
      session.serviceMode === "carry"
        ? [...base.breakdown, "Carry multiplier applied: x2"]
        : base.breakdown,
  };
}
