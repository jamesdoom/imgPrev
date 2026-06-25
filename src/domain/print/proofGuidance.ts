import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";
import type { ProductionProfile } from "./types";

export type ProofGuideId = "bleed" | "safe-area" | "cutlines";

export interface ProofGuide {
  id: ProofGuideId;
  label: string;
  description: string;
  checklist: string;
}

export interface ProofGuidance {
  bleed: ProofGuide;
  safeArea: ProofGuide;
  cutlines: ProofGuide;
}

export function buildProofGuidance(
  profile: ProductionProfile = STICKER_SHEET_MVP_PROFILE
): ProofGuidance {
  const { bleedIn, sheetEdgeMarginIn, stickerSpacingIn } = profile.printRules;

  return {
    bleed: {
      id: "bleed",
      label: "Bleed guide",
      description: `Orange dashed line marks the ${formatInches(
        bleedIn
      )} bleed inset. Artwork that reaches the edge should extend past this guide.`,
      checklist: "Backgrounds and edge artwork extend past the orange bleed guide.",
    },
    safeArea: {
      id: "safe-area",
      label: "Safe area",
      description: `Blue line marks the ${formatInches(
        sheetEdgeMarginIn
      )} safe area from the sheet edge. Keep important artwork inside it.`,
      checklist: "Important text and artwork stay inside the blue safe area.",
    },
    cutlines: {
      id: "cutlines",
      label: "Cutlines",
      description: `Teal dashed outlines show where each decal will be cut. Leave about ${formatInches(
        stickerSpacingIn
      )} between decals for clean cutting.`,
      checklist: "Teal cutlines are visible and have room between decals.",
    },
  };
}

function formatInches(value: number): string {
  const commonFractions = new Map<number, string>([
    [0.125, '1/8"'],
    [0.25, '1/4"'],
    [0.5, '1/2"'],
    [0.75, '3/4"'],
  ]);
  const commonFraction = commonFractions.get(value);

  if (commonFraction) {
    return commonFraction;
  }

  return `${Number(value.toFixed(3))}"`;
}
