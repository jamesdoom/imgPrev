import { describe, expect, it } from "vitest";
import { getWorkflowSteps } from "./workflowProgress";

describe("getWorkflowSteps", () => {
  it("starts customers at upload when no artwork exists", () => {
    expect(
      getWorkflowSteps({
        assetCount: 0,
        canExport: true,
        decalCount: 0,
        isSubmitted: false,
      }).map((step) => [step.label, step.status])
    ).toEqual([
      ["Upload", "current"],
      ["Arrange", "waiting"],
      ["Proof", "waiting"],
      ["Submit", "waiting"],
    ]);
  });

  it("moves customers through arrange, proof, and submit readiness", () => {
    expect(
      getWorkflowSteps({
        assetCount: 2,
        canExport: true,
        decalCount: 3,
        isSubmitted: false,
      }).map((step) => [step.label, step.status])
    ).toEqual([
      ["Upload", "complete"],
      ["Arrange", "complete"],
      ["Proof", "complete"],
      ["Submit", "current"],
    ]);
  });

  it("marks the workflow complete after submission", () => {
    expect(
      getWorkflowSteps({
        assetCount: 2,
        canExport: true,
        decalCount: 3,
        isSubmitted: true,
      }).map((step) => step.status)
    ).toEqual(["complete", "complete", "complete", "complete"]);
  });
});
