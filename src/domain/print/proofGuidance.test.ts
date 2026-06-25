import { describe, expect, it } from "vitest";
import { buildProofGuidance } from "./proofGuidance";
import { STICKER_SHEET_MVP_PROFILE } from "./productionProfiles";

describe("buildProofGuidance", () => {
  it("describes proof guides from the active production profile", () => {
    const guidance = buildProofGuidance(STICKER_SHEET_MVP_PROFILE);

    expect(guidance.bleed.description).toContain("1/8");
    expect(guidance.safeArea.description).toContain("1/4");
    expect(guidance.cutlines.description).toContain("1/4");
  });

  it("provides customer-facing proof checklist copy", () => {
    const guidance = buildProofGuidance();

    expect(guidance.bleed.checklist).toContain("orange bleed guide");
    expect(guidance.safeArea.checklist).toContain("blue safe area");
    expect(guidance.cutlines.checklist).toContain("Teal cutlines");
  });
});
