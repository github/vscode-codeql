import { readFile } from "fs-extra";
import type { RawSourceMap } from "source-map";
import { SourceMapConsumer } from "source-map";
import type {
  TextDocument,
  TextEditor,
  TextEditorSelectionChangeEvent,
} from "vscode";
import {
  Position,
  Selection,
  TextEditorRevealType,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { DisposableObject } from "../common/disposable-object";
import { extLogger } from "../common/logging/vscode";
import { getErrorMessage } from "../common/helpers-pure";
import type { SummaryLanguageSupportCommands } from "../common/commands";
import type { App } from "../common/app";

/** A `Position` within a specified file on disk. */
interface PositionInFile {
  filePath: string;
  position: Position;
}

/**
 * Opens the specified source location in a text editor.
 * @param position The position (including file path) to show.
 */
async function showSourceLocation(position: PositionInFile): Promise<void> {
  const document = await workspace.openTextDocument(position.filePath);
  const editor = await window.showTextDocument(document, ViewColumn.Active);
  editor.selection = new Selection(position.position, position.position);
  editor.revealRange(
    editor.selection,
    TextEditorRevealType.InCenterIfOutsideViewport,
  );
}

/**
 * Simple language support for human-readable evaluator log summaries.
 *
 * This class implements the `codeQL.gotoQL` command, which jumps from RA code to the corresponding
 * QL code that generated it. It also tracks the current selection and active editor to enable and
 * disable that command based on whether there is a QL mapping for the current selection.
 */
export class SummaryLanguageSupport extends DisposableObject {
  /**
   * The last `TextDocument` (with language `ql-summary`) for which we tried to find a sourcemap, or
   * `undefined` if we have not seen such a document yet.
   */
  private lastDocument: TextDocument | undefined = undefined;
  /**
   * The sourcemap for `lastDocument`, or `undefined` if there was no such sourcemap or document.
   */
  private sourceMap: SourceMapConsumer | undefined = undefined;

  constructor(private readonly app: App) {
    super();

    this.push(
      window.onDidChangeActiveTextEditor(
        this.handleDidChangeActiveTextEditor.bind(this),
      ),
    );
    this.push(
      window.onDidChangeTextEditorSelection(
        this.handleDidChangeTextEditorSelection.bind(this),
      ),
    );
    this.push(
      workspace.onDidCloseTextDocument(
        this.handleDidCloseTextDocument.bind(this),
      ),
    );
  }

  public getCommands(): SummaryLanguageSupportCommands {
    return {
      "codeQL.gotoQL": this.handleGotoQL.bind(this),
      "codeQL.gotoQLContextEditor": this.handleGotoQL.bind(this),
    };
  }

  /**
   * Gets the location of the QL code that generated the RA at the current selection in the active
   * editor, or `undefined` if there is no mapping.
   */
  private async getQLSourceLocation(): Promise<PositionInFile | undefined> {
    const editor = window.activeTextEditor;
    if (editor === undefined) {
      return undefined;
    }

    const document = editor.document;
    if (document.languageId !== "ql-summary") {
      return undefined;
    }

    if (document.uri.scheme !== "file") {
      return undefined;
    }

    if (this.lastDocument !== document) {
      this.clearCache();

      const mapPath = `${document.uri.fsPath}.map`;

      try {
        const sourceMapText = await readFile(mapPath, "utf-8");
        const rawMap: RawSourceMap = JSON.parse(sourceMapText);
        this.sourceMap = await new SourceMapConsumer(rawMap);
      } catch (e: unknown) {
        // Error reading sourcemap. Pretend there was no sourcemap.
        void extLogger.log(
          `Error reading sourcemap file '${mapPath}': ${getErrorMessage(e)}`,
        );
        this.sourceMap = undefined;
      }
      this.lastDocument = document;
    }

    if (this.sourceMap === undefined) {
      return undefined;
    }

    const qlPosition = this.sourceMap.originalPositionFor({
      line: editor.selection.start.line + 1,
      column: editor.selection.start.character,
      bias: SourceMapConsumer.GREATEST_LOWER_BOUND,
    });

    if (qlPosition.source === null || qlPosition.line === null) {
      // No position found.
      return undefined;
    }
    const line = qlPosition.line - 1; // In `source-map`, lines are 1-based...
    const column = qlPosition.column ?? 0; // ...but columns are 0-based :(

    return {
      filePath: qlPosition.source,
      position: new Position(line, column),
    };
  }

  /**
   * Clears the cached sourcemap and its corresponding `TextDocument`.
   */
  private clearCache(): void {
    if (this.sourceMap !== undefined) {
      this.sourceMap.destroy();
      this.sourceMap = undefined;
      this.lastDocument = undefined;
    }
  }

  /**
   * Updates the `codeql.hasQLSource` context variable based on the current selection. This variable
   * controls whether or not the `codeQL.gotoQL` command is enabled.
   */
  private async updateContext(): Promise<void> {
    const position = await this.getQLSourceLocation();

    await this.app.commands.execute(
      "setContext",
      "codeql.hasQLSource",
      position !== undefined,
    );
  }

  handleDidChangeActiveTextEditor = async (
    _editor: TextEditor | undefined,
  ): Promise<void> => {
    await this.updateContext();
  };

  handleDidChangeTextEditorSelection = async (
    _e: TextEditorSelectionChangeEvent,
  ): Promise<void> => {
    await this.updateContext();
  };

  handleDidCloseTextDocument = (document: TextDocument): void => {
    if (this.lastDocument === document) {
      this.clearCache();
    }
  };

  handleGotoQL = async (): Promise<void> => {
    const position = await this.getQLSourceLocation();
    if (position !== undefined) {
      await showSourceLocation(position);
    }
  };
}
