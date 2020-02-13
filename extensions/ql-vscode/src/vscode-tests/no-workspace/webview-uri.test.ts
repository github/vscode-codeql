import { expect } from "chai";
import * as path from "path";
import * as tmp from "tmp";
import { window, ViewColumn, Uri } from "vscode";
import { fileUriToWebviewUri, webviewUriToFileUri } from '../../interface';

describe('webview uri conversion', function() {
  const fileSuffix = '.bqrs';

  function setupWebview(filePrefix: string) {
    const tmpFile = tmp.fileSync({ prefix: `uri_test_${filePrefix}_`, postfix: fileSuffix, keep: false });
    const fileUriOnDisk = Uri.file(tmpFile.name);
    const panel = window.createWebviewPanel(
      'test panel',
      'test panel',
      ViewColumn.Beside,
      {
        enableScripts: false,
        localResourceRoots: [
          fileUriOnDisk
        ]
      }
    );
    after(function() {
      panel.dispose();
      tmpFile.removeCallback();
    });

    // CSP allowing nothing, to prevent warnings.
    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none';"></head></html>`;
    panel.webview.html = html;
    return {
      fileUriOnDisk,
      panel
    }
  }

  it('should correctly round trip from filesystem to webview and back', function() {
    const { fileUriOnDisk, panel } = setupWebview('');
    const webviewUri = fileUriToWebviewUri(panel, fileUriOnDisk);
    const reconstructedFileUri = webviewUriToFileUri(webviewUri);
    expect(reconstructedFileUri.toString(true)).to.equal(fileUriOnDisk.toString(true));
  });

  it("does not double-encode # in URIs", function() {
    const { fileUriOnDisk, panel } = setupWebview('#');
    const webviewUri = fileUriToWebviewUri(panel, fileUriOnDisk);
    const parsedUri = Uri.parse(webviewUri);
    expect(path.basename(parsedUri.path, fileSuffix)).to.equal(path.basename(fileUriOnDisk.path, fileSuffix));
  });
});
