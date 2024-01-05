import { join, resolve } from "path";
import type { TextDocument } from "vscode";
import { Uri, window, workspace } from "vscode";
import {
  getQuickEvalContext,
  validateQueryUri,
} from "../../../../src/run-queries-shared";

async function showQlDocument(name: string): Promise<TextDocument> {
  const folderPath = workspace.workspaceFolders![0].uri.fsPath;
  const documentPath = resolve(folderPath, name);
  const document = await workspace.openTextDocument(documentPath);
  await window.showTextDocument(document!);
  return document;
}

export function run() {
  describe("Determining selected query", () => {
    it("should allow ql files to be queried", async () => {
      const queryPath = validateQueryUri(
        Uri.parse("file:///tmp/queryname.ql"),
        false,
      );
      expect(queryPath).toBe(join("/", "tmp", "queryname.ql"));
    });

    it("should allow ql files to be quick-evaled", async () => {
      await showQlDocument("query.ql");
      const q = await getQuickEvalContext(undefined, false);
      expect(
        q.quickEvalPosition.fileName.endsWith(
          join("ql-vscode", "test", "data", "query.ql"),
        ),
      ).toBe(true);
    });

    it("should allow qll files to be quick-evaled", async () => {
      await showQlDocument("library.qll");
      const q = await getQuickEvalContext(undefined, false);
      expect(
        q.quickEvalPosition.fileName.endsWith(
          join("ql-vscode", "test", "data", "library.qll"),
        ),
      ).toBe(true);
    });

    it("should reject non-ql files when running a query", async () => {
      expect(() =>
        validateQueryUri(Uri.parse("file:///tmp/queryname.txt"), false),
      ).toThrow("The selected resource is not a CodeQL query file");
      expect(() =>
        validateQueryUri(Uri.parse("file:///tmp/queryname.qll"), false),
      ).toThrow("The selected resource is not a CodeQL query file");
    });

    it("should reject non-ql[l] files when running a quick eval", async () => {
      await showQlDocument("textfile.txt");
      await expect(getQuickEvalContext(undefined, false)).rejects.toThrow(
        "The selected resource is not a CodeQL file",
      );
    });
  });
}
