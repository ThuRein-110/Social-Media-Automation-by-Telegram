export interface CostUsage {
  dailyCost: number;
  monthlyCost: number;
}

export interface CostLimits {
  dailyLimit: number;
  monthlyLimit: number;
}

export function assertWithinCostLimit(usage: CostUsage, limits: CostLimits, requestedCost: number): void {
  if (limits.dailyLimit > 0 && usage.dailyCost + requestedCost > limits.dailyLimit) {
    throw new Error("AI daily cost limit would be exceeded.");
  }
  if (limits.monthlyLimit > 0 && usage.monthlyCost + requestedCost > limits.monthlyLimit) {
    throw new Error("AI monthly cost limit would be exceeded.");
  }
}
