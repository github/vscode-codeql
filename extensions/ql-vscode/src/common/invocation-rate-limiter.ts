import type { Memento } from "./memento";

/**
 * Provides a utility method to invoke a function only if a minimum time interval has elapsed since
 * the last invocation of that function.
 */
export class InvocationRateLimiter<T> {
  constructor(
    private readonly globalState: Memento,
    private readonly funcIdentifier: string,
    private readonly func: () => Promise<T>,
    private readonly createDate: (dateString?: string) => Date = (s) =>
      s ? new Date(s) : new Date(),
  ) {}

  /**
   * Invoke the function if `minSecondsSinceLastInvocation` seconds have elapsed since the last invocation.
   */
  public async invokeFunctionIfIntervalElapsed(
    minSecondsSinceLastInvocation: number,
  ): Promise<InvocationRateLimiterResult<T>> {
    const updateCheckStartDate = this.createDate();
    const lastInvocationDate = this.getLastInvocationDate();
    if (
      minSecondsSinceLastInvocation &&
      lastInvocationDate &&
      lastInvocationDate <= updateCheckStartDate &&
      lastInvocationDate.getTime() + minSecondsSinceLastInvocation * 1000 >
        updateCheckStartDate.getTime()
    ) {
      return createRateLimitedResult();
    }
    const result = await this.func();
    await this.setLastInvocationDate(updateCheckStartDate);
    return createInvokedResult(result);
  }

  private getLastInvocationDate(): Date | undefined {
    const maybeDateString: string | undefined = this.globalState.get(
      InvocationRateLimiter._invocationRateLimiterPrefix + this.funcIdentifier,
    );
    return maybeDateString ? this.createDate(maybeDateString) : undefined;
  }

  private async setLastInvocationDate(date: Date): Promise<void> {
    return await this.globalState.update(
      InvocationRateLimiter._invocationRateLimiterPrefix + this.funcIdentifier,
      date,
    );
  }

  private static readonly _invocationRateLimiterPrefix =
    "invocationRateLimiter_lastInvocationDate_";
}

export enum InvocationRateLimiterResultKind {
  Invoked,
  RateLimited,
}

/**
 * The function was invoked and returned the value `result`.
 */
interface InvokedResult<T> {
  kind: InvocationRateLimiterResultKind.Invoked;
  result: T;
}

/**
 * The function was not invoked as the minimum interval since the last invocation had not elapsed.
 */
interface RateLimitedResult {
  kind: InvocationRateLimiterResultKind.RateLimited;
}

type InvocationRateLimiterResult<T> = InvokedResult<T> | RateLimitedResult;

function createInvokedResult<T>(result: T): InvokedResult<T> {
  return {
    kind: InvocationRateLimiterResultKind.Invoked,
    result,
  };
}

function createRateLimitedResult(): RateLimitedResult {
  return {
    kind: InvocationRateLimiterResultKind.RateLimited,
  };
}
