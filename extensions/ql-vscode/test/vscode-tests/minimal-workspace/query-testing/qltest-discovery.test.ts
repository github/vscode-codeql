import { Uri, WorkspaceFolder } from "vscode";
import * as fs from "fs-extra";
import { join } from "path";

import { QLTestDiscovery } from "../../../../src/query-testing/qltest-discovery";
import { DirectoryResult } from "tmp-promise";
import * as tmp from "tmp-promise";

import "../../../matchers/toEqualPath";
import { mockedObject } from "../../utils/mocking.helpers";

describe("qltest-discovery", () => {
  describe("discoverTests", () => {
    let directory: DirectoryResult;

    let baseDir: string;
    let cDir: string;
    let dFile: string;
    let eFile: string;
    let hDir: string;
    let iFile: string;
    let qlTestDiscover: QLTestDiscovery;

    beforeEach(async () => {
      directory = await tmp.dir({
        unsafeCleanup: true,
      });

      const baseUri = Uri.file(directory.path);
      baseDir = directory.path;
      cDir = join(baseDir, "c");
      dFile = join(cDir, "d.ql");
      eFile = join(cDir, "e.ql");
      hDir = join(cDir, "f/g/h");
      iFile = join(hDir, "i.ql");

      qlTestDiscover = new QLTestDiscovery(
        mockedObject<WorkspaceFolder>({
          uri: baseUri,
          name: "My tests",
        }),
        {
          resolveTests() {
            return [dFile, eFile, iFile];
          },
        } as any,
      );
    });

    afterEach(async () => {
      await directory.cleanup();
    });

    it("should run discovery", async () => {
      const result = await (qlTestDiscover as any).discover();
      expect(result.watchPath).toEqualPath(baseDir);
      expect(result.testDirectory.path).toEqualPath(baseDir);
      expect(result.testDirectory.name).toBe("My tests");

      let children = result.testDirectory.children;
      expect(children.length).toBe(1);

      expect(children[0].path).toEqualPath(cDir);
      expect(children[0].name).toBe("c");

      children = children[0].children;
      expect(children.length).toBe(3);

      expect(children[0].path).toEqualPath(dFile);
      expect(children[0].name).toBe("d.ql");
      expect(children[1].path).toEqualPath(eFile);
      expect(children[1].name).toBe("e.ql");

      // A merged foler
      expect(children[2].path).toEqualPath(hDir);
      expect(children[2].name).toBe("f / g / h");

      children = children[2].children;
      expect(children[0].path).toEqualPath(iFile);
      expect(children[0].name).toBe("i.ql");
    });

    it("should avoid discovery if a folder does not exist", async () => {
      await fs.remove(baseDir);

      const result = await (qlTestDiscover as any).discover();
      expect(result.watchPath).toEqualPath(baseDir);
      expect(result.testDirectory.path).toEqualPath(baseDir);
      expect(result.testDirectory.name).toBe("My tests");

      expect(result.testDirectory.children.length).toBe(0);
    });
  });
});
