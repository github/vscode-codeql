import {
  EventEmitter,
  FileSystemWatcher,
  Uri,
  WorkspaceFoldersChangeEvent,
  workspace,
} from "vscode";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import {
  QueryDiscovery,
  QueryDiscoveryResults,
} from "../../../../src/queries-panel/query-discovery";
import { createMockApp } from "../../../__mocks__/appMock";
import { mockedObject } from "../../utils/mocking.helpers";
import { basename, join, sep } from "path";
import { sleep } from "../../../../src/pure/time";

describe("QueryDiscovery", () => {
  beforeEach(() => {
    expect(workspace.workspaceFolders?.length).toEqual(1);
  });

  describe("queries", () => {
    it("should return empty list when no QL files are present", async () => {
      const resolveQueries = jest.fn().mockResolvedValue([]);
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueries,
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      const results: QueryDiscoveryResults = await (
        discovery as any
      ).discover();

      expect(results.queries).toEqual([]);
      expect(resolveQueries).toHaveBeenCalledTimes(1);
    });

    it("should organise query files into directories", async () => {
      const workspaceRoot = workspace.workspaceFolders![0].uri.fsPath;
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueries: jest
          .fn()
          .mockResolvedValue([
            join(workspaceRoot, "dir1/query1.ql"),
            join(workspaceRoot, "dir2/query2.ql"),
            join(workspaceRoot, "query3.ql"),
          ]),
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      const results: QueryDiscoveryResults = await (
        discovery as any
      ).discover();

      expect(results.queries[0].children.length).toEqual(3);
      expect(results.queries[0].children[0].name).toEqual("dir1");
      expect(results.queries[0].children[0].children.length).toEqual(1);
      expect(results.queries[0].children[0].children[0].name).toEqual(
        "query1.ql",
      );
      expect(results.queries[0].children[1].name).toEqual("dir2");
      expect(results.queries[0].children[1].children.length).toEqual(1);
      expect(results.queries[0].children[1].children[0].name).toEqual(
        "query2.ql",
      );
      expect(results.queries[0].children[2].name).toEqual("query3.ql");
    });

    it("should collapse directories containing only a single element", async () => {
      const workspaceRoot = workspace.workspaceFolders![0].uri.fsPath;
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueries: jest
          .fn()
          .mockResolvedValue([
            join(workspaceRoot, "dir1/query1.ql"),
            join(workspaceRoot, "dir1/dir2/dir3/dir3/query2.ql"),
          ]),
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      const results: QueryDiscoveryResults = await (
        discovery as any
      ).discover();

      expect(results.queries[0].children.length).toEqual(1);
      expect(results.queries[0].children[0].name).toEqual("dir1");
      expect(results.queries[0].children[0].children.length).toEqual(2);
      expect(results.queries[0].children[0].children[0].name).toEqual(
        "dir2 / dir3 / dir3",
      );
      expect(
        results.queries[0].children[0].children[0].children.length,
      ).toEqual(1);
      expect(
        results.queries[0].children[0].children[0].children[0].name,
      ).toEqual("query2.ql");
      expect(results.queries[0].children[0].children[1].name).toEqual(
        "query1.ql",
      );
    });

    it("calls resolveQueries once for each workspace folder", async () => {
      const workspaceRoots = [
        `${sep}workspace1`,
        `${sep}workspace2`,
        `${sep}workspace3`,
      ];
      jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValueOnce(
        workspaceRoots.map((root, index) => ({
          uri: Uri.file(root),
          name: basename(root),
          index,
        })),
      );

      const resolveQueries = jest.fn().mockImplementation((queryDir) => {
        const workspaceIndex = workspaceRoots.indexOf(queryDir);
        if (workspaceIndex === -1) {
          throw new Error("Unexpected workspace");
        }
        return Promise.resolve([
          join(queryDir, `query${workspaceIndex + 1}.ql`),
        ]);
      });
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueries,
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      const results: QueryDiscoveryResults = await (
        discovery as any
      ).discover();

      expect(results.queries.length).toEqual(3);
      expect(results.queries[0].children[0].name).toEqual("query1.ql");
      expect(results.queries[1].children[0].name).toEqual("query2.ql");
      expect(results.queries[2].children[0].name).toEqual("query3.ql");

      expect(resolveQueries).toHaveBeenCalledTimes(3);
    });
  });

  describe("onDidChangeQueries", () => {
    it("should fire onDidChangeQueries when a watcher fires", async () => {
      const onWatcherDidChangeEvent = new EventEmitter<Uri>();
      const watcher: FileSystemWatcher = {
        ignoreCreateEvents: false,
        ignoreChangeEvents: false,
        ignoreDeleteEvents: false,
        onDidCreate: onWatcherDidChangeEvent.event,
        onDidChange: onWatcherDidChangeEvent.event,
        onDidDelete: onWatcherDidChangeEvent.event,
        dispose: () => undefined,
      };
      const createFileSystemWatcherSpy = jest.spyOn(
        workspace,
        "createFileSystemWatcher",
      );
      createFileSystemWatcherSpy.mockReturnValue(watcher);

      const workspaceRoot = workspace.workspaceFolders![0].uri.fsPath;
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueries: jest
          .fn()
          .mockResolvedValue([join(workspaceRoot, "query1.ql")]),
      });

      const discovery = new QueryDiscovery(
        createMockApp({
          createEventEmitter: () => new EventEmitter(),
        }),
        cli,
      );

      const onDidChangeQueriesSpy = jest.fn();
      discovery.onDidChangeQueries(onDidChangeQueriesSpy);

      const results = await (discovery as any).discover();
      (discovery as any).update(results);

      expect(createFileSystemWatcherSpy).toHaveBeenCalledTimes(2);
      expect(onDidChangeQueriesSpy).toHaveBeenCalledTimes(1);

      onWatcherDidChangeEvent.fire(workspace.workspaceFolders![0].uri);

      // Wait for refresh to finish
      await sleep(100);

      expect(onDidChangeQueriesSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("onDidChangeWorkspaceFolders", () => {
    it("should refresh when workspace folders change", async () => {
      const onDidChangeWorkspaceFoldersEvent =
        new EventEmitter<WorkspaceFoldersChangeEvent>();

      const discovery = new QueryDiscovery(
        createMockApp({
          createEventEmitter: () => new EventEmitter(),
          onDidChangeWorkspaceFolders: onDidChangeWorkspaceFoldersEvent.event,
        }),
        mockedObject<CodeQLCliServer>({
          resolveQueries: jest.fn().mockResolvedValue([]),
        }),
      );

      const onDidChangeQueriesSpy = jest.fn();
      discovery.onDidChangeQueries(onDidChangeQueriesSpy);

      const results = await (discovery as any).discover();
      (discovery as any).update(results);

      expect(onDidChangeQueriesSpy).toHaveBeenCalledTimes(1);

      onDidChangeWorkspaceFoldersEvent.fire({ added: [], removed: [] });

      // Wait for refresh to finish
      await sleep(100);

      expect(onDidChangeQueriesSpy).toHaveBeenCalledTimes(2);
    });
  });
});
