import * as vscode from 'vscode';

// Note that this may open the most recent VSCode workspace.
describe('launching with no specified workspace', () => {
  const ext = vscode.extensions.getExtension('GitHub.vscode-codeql');
  it('should install the extension', () => {
    expect(ext).toBeTruthy();
  });
  it('should not activate the extension at first', () => {
    expect(ext!.isActive === false).toBeTruthy();
  });
});
