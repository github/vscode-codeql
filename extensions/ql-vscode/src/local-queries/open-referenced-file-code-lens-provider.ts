import type { CodeLensProvider, TextDocument, Command } from "vscode";
import { CodeLens, Range } from "vscode";

export class OpenReferencedFileCodeLensProvider implements CodeLensProvider {
  async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = [];

    // A .qlref file is a file that contains a single line with a path to a .ql file.
    if (document.fileName.endsWith(".qlref")) {
      const textLine = document.lineAt(0);
      const range: Range = new Range(
        textLine.range.start.line,
        textLine.range.start.character,
        textLine.range.start.line,
        textLine.range.end.character,
      );

      const command: Command = {
        command: "codeQL.openReferencedFile",
        title: `Open referenced file`,
        arguments: [document.uri],
      };
      const codeLens = new CodeLens(range, command);
      codeLenses.push(codeLens);
    }

    return codeLenses;
  }
}
