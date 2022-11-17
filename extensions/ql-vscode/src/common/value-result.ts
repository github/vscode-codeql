/**
 * Represents a result that can be either a value or some errors.
 */
export class ValueResult<TValue> {
  private constructor(
    private readonly errorMsgs: string[],
    private readonly val?: TValue,
  ) {}

  public static ok<TValue>(value: TValue): ValueResult<TValue> {
    if (value === undefined) {
      throw new Error("Value must be set for successful result");
    }

    return new ValueResult([], value);
  }

  public static fail<TValue>(errorMsgs: string[]): ValueResult<TValue> {
    if (errorMsgs.length === 0) {
      throw new Error(
        "At least one error message must be set for a failed result",
      );
    }

    return new ValueResult<TValue>(errorMsgs, undefined);
  }

  public get isOk(): boolean {
    return this.errorMsgs.length === 0;
  }

  public get isFailure(): boolean {
    return this.errorMsgs.length > 0;
  }

  public get errors(): string[] {
    if (!this.errorMsgs) {
      throw new Error("Cannot get error for successful result");
    }

    return this.errorMsgs;
  }

  public get value(): TValue {
    if (this.val === undefined) {
      throw new Error("Cannot get value for unsuccessful result");
    }

    return this.val;
  }
}
