import type { WebviewPanel } from "vscode";
import { Uri, ViewColumn, window } from "vscode";
import { basename } from "path";
import type { FileResult } from "tmp";
import { fileSync } from "tmp";
import { fileUriToWebviewUri } from "../../../../src/local-queries/webview";
import { getDefaultResultSetName } from "../../../../src/common/interface-types";

describe("interface-utils", () => {
  describe("webview uri conversion", () => {
    const fileSuffix = ".bqrs";

    function setupWebview(filePrefix: string) {
      const tmpFile = fileSync({
        prefix: `uri_test_${filePrefix}_`,
        postfix: fileSuffix,
        keep: false,
      });
      const fileUriOnDisk = Uri.file(tmpFile.name);
      const panel = window.createWebviewPanel(
        "test panel",
        "test panel",
        ViewColumn.Beside,
        {
          enableScripts: false,
          localResourceRoots: [fileUriOnDisk],
        },
      );

      // CSP allowing nothing, to prevent warnings.
      const html =
        '<html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\';"></head></html>';
      panel.webview.html = html;
      return {
        fileUriOnDisk,
        panel,
        tmpFile,
      };
    }

    let webview: {
      fileUriOnDisk: Uri;
      panel: WebviewPanel;
      tmpFile: FileResult;
    };

    afterEach(() => {
      webview?.panel.dispose();
      webview?.tmpFile?.removeCallback();
    });

    it("does not double-encode # in URIs", () => {
      webview = setupWebview("#");

      const { fileUriOnDisk, panel } = webview;
      const webviewUri = fileUriToWebviewUri(panel, fileUriOnDisk);
      const parsedUri = Uri.parse(webviewUri);
      expect(basename(parsedUri.path, fileSuffix)).toBe(
        basename(fileUriOnDisk.path, fileSuffix),
      );
    });
  });

  describe("getDefaultResultSetName", () => {
    it("should get the default name", () => {
      expect(getDefaultResultSetName(["a", "b", "#select", "alerts"])).toBe(
        "alerts",
      );
      expect(getDefaultResultSetName(["a", "b", "#select"])).toBe("#select");
      expect(getDefaultResultSetName(["a", "b"])).toBe("a");
      expect(getDefaultResultSetName([])).toBeUndefined();
    });
  });
});
