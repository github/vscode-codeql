/**
 * A range of characters in a value. The start position is inclusive, the end position is exclusive.
 */
type DiagnosticRange = {
  /**
   * Zero-based index of the first character of the token.
   */
  start: number;
  /**
   * Zero-based index of the character after the last character of the token.
   */
  end: number;
};

/**
 * A diagnostic message.
 */
export type Diagnostic = {
  range: DiagnosticRange;
  message: string;
};
