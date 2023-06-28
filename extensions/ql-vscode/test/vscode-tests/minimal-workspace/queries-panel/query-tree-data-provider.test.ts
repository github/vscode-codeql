import { EventEmitter, env } from "vscode";
import {
  FileTreeDirectory,
  FileTreeLeaf,
} from "../../../../src/common/file-tree-nodes";
import { QueryTreeDataProvider } from "../../../../src/queries-panel/query-tree-data-provider";
import {
  createQueryTreeLeafItem,
  createQueryTreeNodeItem,
  createQueryTreeTextItem,
} from "../../../../src/queries-panel/query-tree-view-item";

describe("QueryTreeDataProvider", () => {
  describe("getChildren", () => {
    it("returns empty array when discovery has not yet happened", async () => {
      const dataProvider = new QueryTreeDataProvider({
        buildQueryTree: () => undefined,
        onDidChangeQueries: jest.fn(),
      });

      expect(dataProvider.getChildren()).toEqual([]);
    });

    it("returns an explanatory message when there are no queries", async () => {
      const dataProvider = new QueryTreeDataProvider({
        buildQueryTree: () => [],
        onDidChangeQueries: jest.fn(),
      });

      expect(dataProvider.getChildren()).toEqual([
        createQueryTreeTextItem(
          "This workspace doesn't contain any CodeQL queries at the moment.",
        ),
      ]);
    });

    it("converts FileTreeNode to QueryTreeViewItem", async () => {
      const dataProvider = new QueryTreeDataProvider({
        buildQueryTree: () => [
          new FileTreeDirectory<string>("dir1", "dir1", env, [
            new FileTreeDirectory<string>("dir1/dir2", "dir2", env, [
              new FileTreeLeaf<string>(
                "dir1/dir2/file1",
                "file1",
                "javascript",
              ),
              new FileTreeLeaf<string>(
                "dir1/dir2/file2",
                "file2",
                "javascript",
              ),
            ]),
          ]),
          new FileTreeDirectory<string>("dir3", "dir3", env, [
            new FileTreeLeaf<string>("dir3/file3", "file3", "javascript"),
          ]),
        ],
        onDidChangeQueries: jest.fn(),
      });

      expect(dataProvider.getChildren()).toEqual([
        createQueryTreeNodeItem("dir1", "dir1", [
          createQueryTreeNodeItem("dir2", "dir1/dir2", [
            createQueryTreeLeafItem("file1", "dir1/dir2/file1", "javascript"),
            createQueryTreeLeafItem("file2", "dir1/dir2/file2", "javascript"),
          ]),
        ]),
        createQueryTreeNodeItem("dir3", "dir3", [
          createQueryTreeLeafItem("file3", "dir3/file3", "javascript"),
        ]),
      ]);
    });
  });

  describe("onDidChangeQueries", () => {
    it("should update tree when the queries change", async () => {
      const queryTree = [
        new FileTreeDirectory<string>("dir1", "dir1", env, [
          new FileTreeLeaf<string>("dir1/file1", "file1", "javascript"),
        ]),
      ];
      const onDidChangeQueriesEmitter = new EventEmitter<void>();
      const queryDiscoverer = {
        buildQueryTree: () => queryTree,
        onDidChangeQueries: onDidChangeQueriesEmitter.event,
      };

      const dataProvider = new QueryTreeDataProvider(queryDiscoverer);
      expect(dataProvider.getChildren().length).toEqual(1);

      queryTree.push(
        new FileTreeDirectory<string>("dir2", "dir2", env, [
          new FileTreeLeaf<string>("dir2/file2", "file2", "javascript"),
        ]),
      );
      onDidChangeQueriesEmitter.fire();

      expect(dataProvider.getChildren().length).toEqual(2);
    });
  });
});
