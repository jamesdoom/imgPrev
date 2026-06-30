import axe from "axe-core";
import { expect } from "vitest";

export async function expectNoA11yViolations(container: Element) {
  const results = await axe.run(container);

  expect(formatViolations(results.violations)).toBe("");
}

function formatViolations(violations: axe.Result[]): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => `    ${node.target.join(", ")}: ${node.failureSummary}`)
        .join("\n");

      return `${violation.id}: ${violation.help}\n${nodes}`;
    })
    .join("\n\n");
}
