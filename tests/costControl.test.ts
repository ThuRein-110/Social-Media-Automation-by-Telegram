import { describe, expect, it } from "vitest";
import { assertWithinCostLimit } from "../src/costs/costControl";

describe("Cost control", () => {
  it("stops when a daily limit would be exceeded", () => {
    expect(() => assertWithinCostLimit({ dailyCost: 0.9, monthlyCost: 2 }, { dailyLimit: 1, monthlyLimit: 10 }, 0.2)).toThrow("daily");
  });

  it("allows work inside configured limits", () => {
    expect(() => assertWithinCostLimit({ dailyCost: 0.2, monthlyCost: 2 }, { dailyLimit: 1, monthlyLimit: 10 }, 0.2)).not.toThrow();
  });
});
