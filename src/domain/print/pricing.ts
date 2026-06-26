import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";
import type { PricingRuleSet, ProductionProfile } from "./types";

export interface SheetOrderEstimate {
  sheetCount: number;
  subtotalCents: number;
  minimumOrderCents: number;
  estimatedOrderCents: number;
  freeShippingThresholdCents: number;
  freeShippingEligible: boolean;
  remainingForFreeShippingCents: number;
}

export function estimateSheetOrder({
  profile = STICKER_SHEET_MVP_PROFILE,
  sheetCount,
}: {
  profile?: ProductionProfile;
  sheetCount: number;
}): SheetOrderEstimate {
  const normalizedSheetCount = Math.max(1, Math.ceil(sheetCount));
  const { pricing } = profile;
  const subtotalCents = normalizedSheetCount * pricing.pricePerSheetCents;
  const estimatedOrderCents = Math.max(
    subtotalCents,
    pricing.minimumOrderCents
  );
  const remainingForFreeShippingCents = Math.max(
    0,
    pricing.freeShippingThresholdCents - estimatedOrderCents
  );

  return {
    sheetCount: normalizedSheetCount,
    subtotalCents,
    minimumOrderCents: pricing.minimumOrderCents,
    estimatedOrderCents,
    freeShippingThresholdCents: pricing.freeShippingThresholdCents,
    freeShippingEligible: estimatedOrderCents >= pricing.freeShippingThresholdCents,
    remainingForFreeShippingCents,
  };
}

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100);
}

export function getPricingRules(
  profile: ProductionProfile = STICKER_SHEET_MVP_PROFILE
): PricingRuleSet {
  return profile.pricing;
}
