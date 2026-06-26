import { describe, expect, it } from "vitest";
import { estimateSheetOrder, formatCurrency } from "./pricing";

describe("estimateSheetOrder", () => {
  it("applies the minimum order for a single sheet", () => {
    expect(estimateSheetOrder({ sheetCount: 1 })).toMatchObject({
      sheetCount: 1,
      subtotalCents: 750,
      minimumOrderCents: 1000,
      estimatedOrderCents: 1000,
      freeShippingEligible: false,
      remainingForFreeShippingCents: 1500,
    });
  });

  it("marks orders at or above twenty five dollars as free shipping eligible", () => {
    expect(estimateSheetOrder({ sheetCount: 4 })).toMatchObject({
      subtotalCents: 3000,
      estimatedOrderCents: 3000,
      freeShippingEligible: true,
      remainingForFreeShippingCents: 0,
    });
  });
});

describe("formatCurrency", () => {
  it("formats cents as US dollars", () => {
    expect(formatCurrency(750)).toBe("$7.50");
  });
});
