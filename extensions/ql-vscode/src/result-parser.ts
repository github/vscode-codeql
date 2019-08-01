import { ResultSets, ElementValue, LocationStyle, StringValue } from "./bqrs-types";

export interface ElementReference {
  readonly element: ElementValue;
  readonly text: string;
}

/**
 * A single result from an `@kind problem` query.
 */
export interface ProblemRow {
  /**
   * The element for which the problem was reported.
   */
  readonly element: ElementValue;
  /**
   * The message for the problem.
   * The message has already had any `$@` placeholders replaced with the corresponding text from
   * the corresponding reference.
   */
  readonly message: string;
  /**
   * An array of element references corresponding to the placeholders in the message.
   */
  readonly references?: ElementReference[];
}

/**
 * Replaces any `$@` placeholders in a string with specified replacement text.
 * @param rawMessage The original message containing `$@` placeholders.
 * @param args The text to substitute for each corresponding placeholder.
 */
function replacePlaceholders(rawMessage: string, args: string[]): string {
  let placeholderIndex = 0;
  return rawMessage.replace('$@', placeholder => {
    if (placeholderIndex < args.length) {
      const argIndex = placeholderIndex;
      ++placeholderIndex;
      return args[argIndex];
    }
    else {
      return placeholder;
    }
  });
}

/**
 * Parses the raw results of an `@kind problem` query into `ProblemRow` objects.
 */
export class ProblemResultsParser {
  constructor(private resultSets: ResultSets, private referenceCount: number) {
  }

  /**
   * Parses the results into `ProblemRow` objects.
   */
  public *parse(): IterableIterator<ProblemRow> {
    for (const row of this.resultSets.results[0].results) {
      let message = (row[1] as StringValue).v;
      let references: ElementReference[] | undefined = undefined;
      if (this.referenceCount > 0) {
        references = [];
        for (let referenceIndex = 0; referenceIndex < this.referenceCount; ++referenceIndex) {
          const elementColumn = row[(referenceIndex * 2) + 2] as ElementValue;
          const textColumn = row[(referenceIndex * 2) + 3] as StringValue;
          references.push({
            element: elementColumn,
            text: textColumn.v
          });
        }

        message = replacePlaceholders(message, references.map(ref => ref.text));
      }

      yield {
        element: row[0] as ElementValue,
        message: message,
        references: references
      };
    }
  }

  /**
   * Creates a parser for the specified results, if the specified results match the schema for an
   * `@kind problem` query. Otherwise, returns `undefined`.
   * @param resultSets The results to parse.
   */
  public static tryFromResultSets(resultSets: ResultSets): ProblemResultsParser | undefined {
    const result = ProblemResultsParser.canParseResultSets(resultSets);
    if (result) {
      return new ProblemResultsParser(resultSets, result.referenceCount);
    }
    else {
      return undefined;
    }
  }

  private static canParseResultSets(resultSets: ResultSets):
    { referenceCount: number } | undefined {

    if (resultSets.header.numberOfResultSets !== 1) {
      // Wrong number of result sets.
      return undefined;
    }

    const resultSet = resultSets.results[0];
    if ((resultSet.columns.length < 2) || ((resultSet.columns.length % 2) != 0)) {
      // Wrong number of columns.
      return undefined;
    }

    const elementColumnType = resultSet.columns[0].t;
    if (typeof elementColumnType === 'string') {
      // Expected an element in column 0.
      return undefined;
    }
    else {
      if (elementColumnType.locationStyle !== LocationStyle.FivePart) {
        // Only support FivePart locations for now.
        return undefined;
      }
      if (!elementColumnType.hasLabel) {
        // Expected column 0 to include a label.
      }
    }

    const messageColumnType = resultSet.columns[1].t;
    if (messageColumnType !== 's') {
      // Expected a string in column 1.
      return undefined;
    }

    const placeholderCount = (resultSet.columns.length - 2) / 2;
    for (let placeholderIndex = 0; placeholderIndex < placeholderCount; ++placeholderIndex) {
      const referenceElementColumnType = resultSet.columns[(placeholderIndex * 2) + 2].t;
      if (typeof referenceElementColumnType === 'string') {
        // Expected an element.
        return undefined;
      }
      if (referenceElementColumnType.locationStyle !== LocationStyle.FivePart) {
        // Only support FivePart locations for now.
        return undefined;
      }
      const textColumnType = resultSet.columns[(placeholderIndex * 2) + 3].t;
      if (textColumnType !== 's') {
        // Expected a string.
        return undefined;
      }
    }

    return { referenceCount: placeholderCount };
  }
}