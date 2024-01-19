import { EventEmitter, env } from "vscode";
import {
  FileTreeDirectory,
  FileTreeLeaf,
} from "../../../../src/common/file-tree-nodes";
import { QueryTreeDataProvider } from "../../../../src/queries-panel/query-tree-data-provider";
import {
  createQueryTreeFileItem,
  createQueryTreeFolderItem,
} from "../../../../src/queries-panel/query-tree-view-item";
import { createMockApp } from "../../../__mocks__/appMock";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";

describe("QueryTreeDataProvider", () => {
  describe("getChildren", () => {
    it("returns empty array when discovery has not yet happened", async () => {
      const dataProvider = new QueryTreeDataProvider(
        {
          buildQueryTree: () => undefined,
          onDidChangeQueries: jest.fn(),
        },
        createMockApp({}),
      );

      expect(dataProvider.getChildren()).toEqual([]);
    });

    it("set 'noQueries' context value when there are no queries", async () => {
      const executeCommand = jest.fn();

      const dataProvider = new QueryTreeDataProvider(
        {
          buildQueryTree: () => [],
          onDidChangeQueries: jest.fn(),
        },
        createMockApp({
          commands: createMockCommandManager({ executeCommand }),
        }),
      );

      expect(dataProvider.getChildren()).toEqual([]);
      expect(executeCommand).toHaveBeenCalledWith(
        "setContext",
        "codeQL.noQueries",
        true,
      );
    });

    it("converts FileTreeNode to QueryTreeViewItem", async () => {
      const dataProvider = new QueryTreeDataProvider(
        {
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
        },
        createMockApp({}),
      );

      expect(dataProvider.getChildren()).toEqual([
        createQueryTreeFolderItem("dir1", "dir1", [
          createQueryTreeFolderItem("dir2", "dir1/dir2", [
            createQueryTreeFileItem("file1", "dir1/dir2/file1", "javascript"),
            createQueryTreeFileItem("file2", "dir1/dir2/file2", "javascript"),
          ]),
        ]),
        createQueryTreeFolderItem("dir3", "dir3", [
          createQueryTreeFileItem("file3", "dir3/file3", "javascript"),
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

      const executeCommand = jest.fn();

      const dataProvider = new QueryTreeDataProvider(
        queryDiscoverer,
        createMockApp({
          commands: createMockCommandManager({ executeCommand }),
        }),
      );
      expect(dataProvider.getChildren().length).toEqual(1);

      queryTree.push(
        new FileTreeDirectory<string>("dir2", "dir2", env, [
          new FileTreeLeaf<string>("dir2/file2", "file2", "javascript"),
        ]),
      );
      onDidChangeQueriesEmitter.fire();

      expect(dataProvider.getChildren().length).toEqual(2);
      expect(executeCommand).toHaveBeenCalledWith(
        "setContext",
        "codeQL.noQueries",
        false,
      );
    });
  });
});
