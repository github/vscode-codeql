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
      .map((s, i) => s + (this.hasValue(i) ? this.getRedactedValue(i) : ""))
      .join("");
  }

  private getValue(index: number): unknown {
    const value = this.values[index];
    if (value instanceof RedactableErrorMessage) {
      return value.fullMessage;
    }
    return value;
  }

  private getRedactedValue(index: number): unknown {
    const value = this.values[index];
    if (value instanceof RedactableErrorMessage) {
      return value.redactedMessage;
    }
    return "[REDACTED]";
  }

  private hasValue(index: number): boolean {
    return index < this.values.length;
  }
}

export function redactableErrorMessage(
  strings: TemplateStringsArray,
  ...values: unknown[]
): RedactableErrorMessage {
  return new RedactableErrorMessage(strings, values);
}
