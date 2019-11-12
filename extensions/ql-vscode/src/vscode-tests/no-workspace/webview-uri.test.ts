import { expect } from "chai";
import * as tmp from "tmp";
import { window, ViewColumn, Uri } from "vscode";
import { fileUriToWebviewUri, webviewUriToFileUri } from '../../interface';

describe('webview uri conversion', function () {
  it('should correctly round trip from filesystem to webview and back', function () {
    const tmpFile = tmp.fileSync({ prefix: 'uri_test_', postfix: '.bqrs', keep: false });
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
    after(function () {
      panel.dispose();
      tmpFile.removeCallback();
    });

    // CSP allowing nothing, to prevent warnings.
    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none';"></head></html>`;
    panel.webview.html = html;

    const webviewUri = fileUriToWebviewUri(panel, fileUriOnDisk);
    const reconstructedFileUri = webviewUriToFileUri(webviewUri);
    expect(reconstructedFileUri.toString(true)).to.equal(fileUriOnDisk.toString(true));
  });
});
