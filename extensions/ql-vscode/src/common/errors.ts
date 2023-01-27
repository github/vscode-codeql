export class RedactableErrorMessage {
  constructor(
    private readonly strings: TemplateStringsArray,
    private readonly values: unknown[],
  ) {}

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
      .map((s, i) => s + (this.hasValue(i) ? "[REDACTED]" : ""))
      .join("");
  }

  private getValue(index: number): unknown {
    return this.values[index];
  }

  private hasValue(index: number): boolean {
    return index < this.values.length;
  }
}

export function errorMessage(
  strings: TemplateStringsArray,
  ...values: unknown[]
): RedactableErrorMessage {
  return new RedactableErrorMessage(strings, values);
}
