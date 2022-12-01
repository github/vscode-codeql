import { resolve, join } from "path";
import * as vscode from "vscode";
import { Uri } from "vscode";
import { determineSelectedQuery } from "../../run-queries-shared";

async function showQlDocument(name: string): Promise<vscode.TextDocument> {
  const folderPath = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const documentPath = resolve(folderPath, name);
  const document = await vscode.workspace.openTextDocument(documentPath);
  await vscode.window.showTextDocument(document!);
  return document;
}

export function run() {
  describe("Determining selected query", () => {
    it("should allow ql files to be queried", async () => {
      const q = await determineSelectedQuery(
        Uri.parse("file:///tmp/queryname.ql"),
        false,
      );
      expect(q.queryPath).toBe(join("/", "tmp", "queryname.ql"));
      expect(q.quickEvalPosition).toBeUndefined();
    });

    it("should allow ql files to be quick-evaled", async () => {
      const doc = await showQlDocument("query.ql");
      const q = await determineSelectedQuery(doc.uri, true);
      expect(
        q.queryPath.endsWith(join("ql-vscode", "test", "data", "query.ql")),
      ).toBe(true);
    });

    it("should allow qll files to be quick-evaled", async () => {
      const doc = await showQlDocument("library.qll");
      const q = await determineSelectedQuery(doc.uri, true);
      expect(
        q.queryPath.endsWith(join("ql-vscode", "test", "data", "library.qll")),
      ).toBe(true);
    });

    it("should reject non-ql files when running a query", async () => {
      await expect(
        determineSelectedQuery(Uri.parse("file:///tmp/queryname.txt"), false),
      ).rejects.toThrow("The selected resource is not a CodeQL query file");
      await expect(
        determineSelectedQuery(Uri.parse("file:///tmp/queryname.qll"), false),
      ).rejects.toThrow("The selected resource is not a CodeQL query file");
    });

    it("should reject non-ql[l] files when running a quick eval", async () => {
      await expect(
        determineSelectedQuery(Uri.parse("file:///tmp/queryname.txt"), true),
      ).rejects.toThrow("The selected resource is not a CodeQL file");
    });
  });
}
