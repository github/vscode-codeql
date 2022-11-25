import { Uri, WorkspaceFolder } from "vscode";
import { expect } from "chai";
import * as fs from "fs-extra";
import * as sinon from "sinon";

import { QLTestDiscovery } from "../../qltest-discovery";

describe("qltest-discovery", () => {
  describe("discoverTests", () => {
    let sandbox: sinon.SinonSandbox;

    const baseUri = Uri.parse("file:/a/b");
    const baseDir = baseUri.fsPath;
    const cDir = Uri.parse("file:/a/b/c").fsPath;
    const dFile = Uri.parse("file:/a/b/c/d.ql").fsPath;
    const eFile = Uri.parse("file:/a/b/c/e.ql").fsPath;
    const hDir = Uri.parse("file:/a/b/c/f/g/h").fsPath;
    const iFile = Uri.parse("file:/a/b/c/f/g/h/i.ql").fsPath;
    let qlTestDiscover: QLTestDiscovery;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      qlTestDiscover = new QLTestDiscovery(
        {
          uri: baseUri,
          name: "My tests",
        } as unknown as WorkspaceFolder,
        {
          resolveTests() {
            return [
              Uri.parse("file:/a/b/c/d.ql").fsPath,
              Uri.parse("file:/a/b/c/e.ql").fsPath,
              Uri.parse("file:/a/b/c/f/g/h/i.ql").fsPath,
            ];
          },
        } as any,
      );
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should run discovery", async () => {
      sandbox.stub(fs, "pathExists").resolves(true);

      const result = await (qlTestDiscover as any).discover();
      expect(result.watchPath).to.eq(baseDir);
      expect(result.testDirectory.path).to.eq(baseDir);
      expect(result.testDirectory.name).to.eq("My tests");

      let children = result.testDirectory.children;
      expect(children[0].path).to.eq(cDir);
      expect(children[0].name).to.eq("c");
      expect(children.length).to.eq(1);

      children = children[0].children;
      expect(children[0].path).to.eq(dFile);
      expect(children[0].name).to.eq("d.ql");
      expect(children[1].path).to.eq(eFile);
      expect(children[1].name).to.eq("e.ql");

      // A merged foler
      expect(children[2].path).to.eq(hDir);
      expect(children[2].name).to.eq("f / g / h");
      expect(children.length).to.eq(3);

      children = children[2].children;
      expect(children[0].path).to.eq(iFile);
      expect(children[0].name).to.eq("i.ql");
    });

    it("should avoid discovery if a folder does not exist", async () => {
      sandbox.stub(fs, "pathExists").resolves(false);
      const result = await (qlTestDiscover as any).discover();
      expect(result.watchPath).to.eq(baseDir);
      expect(result.testDirectory.path).to.eq(baseDir);
      expect(result.testDirectory.name).to.eq("My tests");

      expect(result.testDirectory.children.length).to.eq(0);
    });
  });
});
