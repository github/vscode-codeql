import * as chai from "chai";
import "mocha";
import * as vscode from "vscode";
import * as sinon from "sinon";
// import * as sinonChai from 'sinon-chai';
import * as chaiAsPromised from "chai-as-promised";
import { logger } from "../../logging";
import { QueryHistoryManager } from "../../query-history";

chai.use(chaiAsPromised);
const expect = chai.expect;



describe('query-history', () => {

  describe("tryOpenExternalFile", () => {
    let showTextDocumentSpy: sinon.SinonStub;
    let showInformationMessageSpy: sinon.SinonStub;
    let executeCommandSpy: sinon.SinonStub;
    let logSpy: sinon.SinonStub;

    let tryOpenExternalFile: Function;

    beforeEach(() => {
      showTextDocumentSpy = sinon.stub(vscode.window, "showTextDocument");
      showInformationMessageSpy = sinon.stub(
        vscode.window,
        "showInformationMessage"
      );
      executeCommandSpy = sinon.stub(vscode.commands, "executeCommand");
      logSpy = sinon.stub(logger, "log");
      tryOpenExternalFile = (QueryHistoryManager.prototype as any).tryOpenExternalFile;
      logSpy;
      executeCommandSpy;
    });

    afterEach(() => {
      (vscode.window.showTextDocument as sinon.SinonStub).restore();
      (vscode.commands.executeCommand as sinon.SinonStub).restore();
      (logger.log as sinon.SinonStub).restore();
      (vscode.window.showInformationMessage as sinon.SinonStub).restore();
    });

    it("should open an external file", async () => {
      await tryOpenExternalFile('xxx');
      expect(showTextDocumentSpy).to.have.been.calledOnceWith(
        vscode.Uri.file('xxx')
      );
      expect(executeCommandSpy).not.to.have.been.called;
    });

    [
      "too large to open",
      "Files above 50MB cannot be synchronized with extensions",
    ].forEach(msg => {
      it(`should fail to open a file because "${msg}" and open externally`, async () => {
        showTextDocumentSpy.throws(new Error(msg));
        showInformationMessageSpy.returns({ title: "Yes" });

        await tryOpenExternalFile("xxx");
        const uri = vscode.Uri.file("xxx");
        expect(showTextDocumentSpy).to.have.been.calledOnceWith(
          uri
        );
        expect(executeCommandSpy).to.have.been.calledOnceWith(
          "revealFileInOS",
          uri
        );
      });

      it(`should fail to open a file because "${msg}" and NOT open externally`, async () => {
        showTextDocumentSpy.throws(new Error(msg));
        showInformationMessageSpy.returns({ title: "No" });

        await tryOpenExternalFile("xxx");
        const uri = vscode.Uri.file("xxx");
        expect(showTextDocumentSpy).to.have.been.calledOnceWith(uri);
        expect(showInformationMessageSpy).to.have.been.called;
        expect(executeCommandSpy).not.to.have.been.called;
      });
    });
  });
});
