// Based on https://github.com/microsoft/vscode/blob/edfd5b8ba54d50f3f5c2ebee877af088803def88/src/vs/base/common/labels.ts#L316C1-L400

/**
 * Helper to insert values for specific template variables into the string. E.g. "this ${is} a ${template}" can be
 * passed to this function together with an object that maps "is" and "template" to strings to have them replaced.
 *
 * @param template string to which template is applied
 * @param values the values of the templates to use
 */
export function substituteConfigVariables(
  template: string,
  values: {
    [key: string]: string | undefined | null;
  },
): string {
  const segments: string[] = [];

  let inVariable = false;
  let currentValue = "";
  for (const char of template) {
    // Beginning of variable
    if (char === "$" || (inVariable && char === "{")) {
      if (currentValue) {
        segments.push(currentValue);
      }

      currentValue = "";
      inVariable = true;
    }

    // End of variable
    else if (char === "}" && inVariable) {
      const resolved = values[currentValue];

      // Variable
      if (resolved && resolved.length > 0) {
        segments.push(resolved);
      }
      // If the variable, doesn't exist, we discard it (i.e. replace it by the empty string)

      currentValue = "";
      inVariable = false;
    }

    // Text or Variable Name
    else {
      currentValue += char;
    }
  }

  // Tail
  if (currentValue && !inVariable) {
    segments.push(currentValue);
  }

  return segments.join("");
}
