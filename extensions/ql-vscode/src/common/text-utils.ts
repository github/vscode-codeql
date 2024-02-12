const CONTROL_CODE = "\u001F".codePointAt(0)!;
const CONTROL_LABEL = "\u2400".codePointAt(0)!;

/**
 * Converts the given text so that any non-printable characters are replaced.
 * @param label The text to convert.
 * @returns The converted text.
 */
export function convertNonPrintableChars(label: string | undefined) {
  // If the label was empty, use a placeholder instead, so the link is still clickable.
  if (!label) {
    return "[empty string]";
  } else if (label.match(/^\s+$/)) {
    return `[whitespace: "${label}"]`;
  } else {
    /**
     * If the label contains certain non-printable characters, loop through each
     * character and replace it with the cooresponding unicode control label.
     */
    const convertedLabelArray: string[] = [];
    for (let i = 0; i < label.length; i++) {
      const labelCheck = label.codePointAt(i)!;
      if (labelCheck <= CONTROL_CODE) {
        convertedLabelArray[i] = String.fromCodePoint(
          labelCheck + CONTROL_LABEL,
        );
      } else {
        convertedLabelArray[i] = label.charAt(i);
      }
    }
    return convertedLabelArray.join("");
  }
}

export function findDuplicateStrings(strings: string[]): string[] {
  const dups = strings.filter(
    (string, index, strings) => strings.indexOf(string) !== index,
  );

  return [...new Set(dups)];
}
