import { QueriesPanel } from "../../../../src/queries-panel/queries-panel";
import {
  FileTreeDirectory,
  FileTreeLeaf,
} from "../../../../src/common/file-tree-nodes";
import { createMockEnvironmentContext } from "../../../__mocks__/appMock";
import { join } from "path";

describe("QueriesPanel", () => {
  const env = createMockEnvironmentContext();

  describe("getMessage", () => {
    it("should show treeview message when there are no queries", async () => {
      const queryDiscoverer = {
        buildQueryTree: () => [],
        onDidChangeQueries: jest.fn(),
      };

      const queriesPanel = new QueriesPanel(queryDiscoverer);

      expect(queriesPanel.getMessage()).toBe(
        "We didn't find any CodeQL queries in this workspace. Create one to get started.",
      );
    });
    it("should hide treeview message when there are queries", async () => {
      const queryDiscoverer = {
        buildQueryTree: () => [
          new FileTreeDirectory("tmp", "workspace", env, [
            new FileTreeLeaf(join("tmp", "query.ql"), "query.ql", "java"),
          ]),
        ],
        onDidChangeQueries: jest.fn(),
      };

      const queriesPanel = new QueriesPanel(queryDiscoverer);

      expect(queriesPanel.getMessage()).toBe(undefined);
    });
  });
});
