export class FinancialExecutionDisabled extends Error {
  readonly code = "FINANCIAL_EXECUTION_DISABLED";

  constructor(action: string) {
    super(`Financial execution is disabled: ${action}`);
    this.name = "FinancialExecutionDisabled";
  }
}

export function executeSwap(): never {
  throw new FinancialExecutionDisabled("signing or broadcasting a swap");
}

export function executeCardPayment(): never {
  throw new FinancialExecutionDisabled("submitting a card payment");
}

export function broadcastTransaction(): never {
  throw new FinancialExecutionDisabled("broadcasting a transaction");
}
