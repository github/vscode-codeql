export class RedactableError extends Error {
  constructor(
    cause: Error | undefined,
    private readonly strings: TemplateStringsArray,
    private readonly values: unknown[],
  ) {
    super();

    this.message = this.fullMessage;
    if (cause !== undefined) {
      this.stack = cause.stack;
    }
  }

  public toString(): string {
    return this.fullMessage;
  }

  public get fullMessage(): string {
    return this.strings
      .map((s, i) => s + (this.hasValue(i) ? this.getValue(i) : ""))
      .join("");
  }

  public get redactedMessage(): string {
    return this.strings
      .map((s, i) => s + (this.hasValue(i) ? this.getRedactedValue(i) : ""))
      .join("");
  }

  private getValue(index: number): unknown {
    const value = this.values[index];
    if (value instanceof RedactableError) {
      return value.fullMessage;
    }
    return value;
  }

  private getRedactedValue(index: number): unknown {
    const value = this.values[index];
    if (value instanceof RedactableError) {
      return value.redactedMessage;
    }
    return "[REDACTED]";
  }

  private hasValue(index: number): boolean {
    return index < this.values.length;
  }
}

export function redactableError(
  strings: TemplateStringsArray,
  ...values: unknown[]
): RedactableError;
export function redactableError(
  error: Error,
): (strings: TemplateStringsArray, ...values: unknown[]) => RedactableError;

export function redactableError(
  errorOrStrings: Error | TemplateStringsArray,
  ...values: unknown[]
):
  | ((strings: TemplateStringsArray, ...values: unknown[]) => RedactableError)
  | RedactableError {
  if (errorOrStrings instanceof Error) {
    return (strings: TemplateStringsArray, ...values: unknown[]) =>
      new RedactableError(errorOrStrings, strings, values);
  } else {
    return new RedactableError(undefined, errorOrStrings, values);
  }
}
