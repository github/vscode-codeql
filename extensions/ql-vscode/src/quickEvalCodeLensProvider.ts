import {
  CodeLensProvider,
  TextDocument,
  CodeLens, 
  Command,
  Range
} from 'vscode';
  
class QuickEvalCodeLensProvider implements CodeLensProvider {
  async provideCodeLenses(document: TextDocument): Promise<CodeLens[]> {

    const codeLenses: CodeLens[] = [];

    for (let index = 0; index < document.lineCount; index++) {
      const textLine = document.lineAt(index);
      // Match a predicate signature, including predicate name, parameter list, and opening brace.
      const regex = new RegExp(/(\w+)\s*\(\s*.*(?:,\s*)*\)\s*\{/);
      const matches = textLine.text.match(regex);

      if (matches) {
        const range: Range = new Range(
          textLine.range.start.line, matches.index!,
          textLine.range.end.line, matches.index! + 1
        );

        const command: Command = {
          command: 'codeQL.codeLensQuickEval',
          title: `Quick Evaluation: ${matches[1]}`,
          arguments: [document.uri, range]
        };
        const codeLens = new CodeLens(range, command);
        codeLenses.push(codeLens);
      }
    }
    return codeLenses;
  }
}
  
export default QuickEvalCodeLensProvider;