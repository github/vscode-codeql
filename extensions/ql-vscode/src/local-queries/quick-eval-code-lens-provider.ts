import type { CodeLensProvider, TextDocument, Command } from "vscode";
import { CodeLens, Range } from "vscode";
import { isQuickEvalCodelensEnabled } from "../config";

export class QuickEvalCodeLensProvider implements CodeLensProvider {
  async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = [];

    if (isQuickEvalCodelensEnabled()) {
      for (let index = 0; index < document.lineCount; index++) {
        const textLine = document.lineAt(index);

        // Match a predicate signature, including predicate name, parameter list, and opening brace.
        // This currently does not match predicates that span multiple lines.
        const regex = new RegExp(/(\w+)\s*\([^()]*\)\s*\{/);

        const matches = textLine.text.match(regex);

        // Make sure that a code lens is not generated for any predicate that is commented out.
        if (matches && !/^\s*\/\//.test(textLine.text)) {
          const range: Range = new Range(
            textLine.range.start.line,
            matches.index!,
            textLine.range.end.line,
            matches.index! + 1,
          );

          const command: Command = {
            command: "codeQL.codeLensQuickEval",
            title: `Quick Evaluation: ${matches[1]}`,
            arguments: [document.uri, range],
          };
          const codeLens = new CodeLens(range, command);
          codeLenses.push(codeLens);
        }
      }
    }
    return codeLenses;
  }
}
