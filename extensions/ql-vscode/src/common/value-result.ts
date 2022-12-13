/**
 * Represents a result that can be either a value or some errors.
 */
export class ValueResult<TValue, TError> {
  private constructor(
    private readonly errs: TError[],
    private readonly val?: TValue,
  ) {}

  public static ok<TValue, TError>(value: TValue): ValueResult<TValue, TError> {
    if (value === undefined) {
      throw new Error("Value must be set for successful result");
    }

    return new ValueResult([], value);
  }

  public static fail<TValue, TError>(
    errors: TError[],
  ): ValueResult<TValue, TError> {
    if (errors.length === 0) {
      throw new Error("At least one error must be set for a failed result");
    }

    return new ValueResult<TValue, TError>(errors, undefined);
  }

  public get isOk(): boolean {
    return this.errs.length === 0;
  }

  public get isFailure(): boolean {
    return this.errs.length > 0;
  }

  public get errors(): TError[] {
    if (!this.errs) {
      throw new Error("Cannot get error for successful result");
    }

    return this.errs;
  }

  public get value(): TValue {
    if (this.val === undefined) {
      throw new Error("Cannot get value for unsuccessful result");
    }

    return this.val;
  }
}
