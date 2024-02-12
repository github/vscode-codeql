export class RedactableError extends Error {
  constructor(
    cause: ErrorLike | undefined,
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

  public get fullMessageWithStack(): string {
    if (!this.stack) {
      return this.fullMessage;
    }

    return `${this.fullMessage}\n${this.stack}`;
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
  error: ErrorLike,
): (strings: TemplateStringsArray, ...values: unknown[]) => RedactableError;

export function redactableError(
  errorOrStrings: ErrorLike | TemplateStringsArray,
  ...values: unknown[]
):
  | ((strings: TemplateStringsArray, ...values: unknown[]) => RedactableError)
  | RedactableError {
  if (isErrorLike(errorOrStrings)) {
    return (strings: TemplateStringsArray, ...values: unknown[]) =>
      new RedactableError(errorOrStrings, strings, values);
  } else {
    return new RedactableError(undefined, errorOrStrings, values);
  }
}

export interface ErrorLike {
  message: string;
  stack?: string;
}

function isErrorLike(error: unknown): error is ErrorLike {
  return (
    error !== undefined &&
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    (!("stack" in error) || typeof error.stack === "string")
  );
}
