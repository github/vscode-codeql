import { EventEmitter, env } from "vscode";
import {
  FileTreeDirectory,
  FileTreeLeaf,
} from "../../../../src/common/file-tree-nodes";
import { QueryTreeDataProvider } from "../../../../src/queries-panel/query-tree-data-provider";

describe("QueryTreeDataProvider", () => {
  describe("getChildren", () => {
    it("returns no children when there are no queries", async () => {
      const dataProvider = new QueryTreeDataProvider({
        buildQueryTree: () => [],
        onDidChangeQueries: jest.fn(),
      });

      expect(dataProvider.getChildren()).toEqual([]);
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
                "dir1/dir2/file1",
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

      expect(dataProvider.getChildren().length).toEqual(2);

      expect(dataProvider.getChildren()[0].label).toEqual("dir1");
      expect(dataProvider.getChildren()[0].children.length).toEqual(1);
      expect(dataProvider.getChildren()[0].children[0].label).toEqual("dir2");
      expect(dataProvider.getChildren()[0].children[0].children.length).toEqual(
        2,
      );
      expect(
        dataProvider.getChildren()[0].children[0].children[0].label,
      ).toEqual("file1");
      expect(
        dataProvider.getChildren()[0].children[0].children[1].label,
      ).toEqual("file2");

      expect(dataProvider.getChildren()[1].label).toEqual("dir3");
      expect(dataProvider.getChildren()[1].children.length).toEqual(1);
      expect(dataProvider.getChildren()[1].children[0].label).toEqual("file3");
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
