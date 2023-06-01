import {
  EventEmitter,
  FileSystemWatcher,
  Uri,
  WorkspaceFoldersChangeEvent,
  workspace,
} from "vscode";
import {
  CodeQLCliServer,
  QueryInfoByLanguage,
} from "../../../../src/codeql-cli/cli";
import { QueryDiscovery } from "../../../../src/queries-panel/query-discovery";
import { createMockApp } from "../../../__mocks__/appMock";
import { mockedObject } from "../../utils/mocking.helpers";
import { basename, join, sep } from "path";

describe("QueryDiscovery", () => {
  beforeEach(() => {
    expect(workspace.workspaceFolders?.length).toEqual(1);
  });

  function mockResolveQueryByLanguage(
    dataFn: (queryDir: string) => {
      byLanguage?: Record<string, string[]>;
      noDeclaredLanguage?: string[];
      multipleDeclaredLanguages?: string[];
    },
  ) {
    return jest.fn().mockImplementation((queryDir: Uri) => {
      const data = dataFn(queryDir.fsPath);
      const value: QueryInfoByLanguage = {
        byLanguage: Object.keys(data.byLanguage || {}).reduce((result, key) => {
          result[key] = queriesArrayToRecord(data.byLanguage![key]);
          return result;
        }, {} as QueryInfoByLanguage["byLanguage"]),
        noDeclaredLanguage: queriesArrayToRecord(data.noDeclaredLanguage || []),
        multipleDeclaredLanguages: queriesArrayToRecord(
          data.multipleDeclaredLanguages || [],
        ),
      };
      return Promise.resolve(value);
    });
  }

  function queriesArrayToRecord(queries: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const query of queries) {
      result[query] = {};
    }
    return result;
  }

  describe("queries", () => {
    it("should return empty list when no QL files are present", async () => {
      const resolveQueryByLanguage = mockResolveQueryByLanguage(() => ({}));
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueryByLanguage,
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      await discovery.refresh();
      const queries = discovery.queries;

      expect(queries).toEqual([]);
      expect(resolveQueryByLanguage).toHaveBeenCalledTimes(1);
    });

    it("should organise query files into directories", async () => {
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueryByLanguage: mockResolveQueryByLanguage((queryDir) => ({
          byLanguage: {
            java: [
              join(queryDir, "dir1/query1.ql"),
              join(queryDir, "dir2/query2.ql"),
              join(queryDir, "query3.ql"),
            ],
          },
        })),
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      await discovery.refresh();
      const queries = discovery.queries;
      expect(queries).toBeDefined();

      expect(queries![0].children.length).toEqual(3);
      expect(queries![0].children[0].name).toEqual("dir1");
      expect(queries![0].children[0].children.length).toEqual(1);
      expect(queries![0].children[0].children[0].name).toEqual("query1.ql");
      expect(queries![0].children[1].name).toEqual("dir2");
      expect(queries![0].children[1].children.length).toEqual(1);
      expect(queries![0].children[1].children[0].name).toEqual("query2.ql");
      expect(queries![0].children[2].name).toEqual("query3.ql");
    });

    it("should collapse directories containing only a single element", async () => {
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueryByLanguage: mockResolveQueryByLanguage((queryDir) => ({
          byLanguage: {
            java: [
              join(queryDir, "dir1/query1.ql"),
              join(queryDir, "dir1/dir2/dir3/dir3/query2.ql"),
            ],
          },
        })),
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      await discovery.refresh();
      const queries = discovery.queries;
      expect(queries).toBeDefined();

      expect(queries![0].children.length).toEqual(1);
      expect(queries![0].children[0].name).toEqual("dir1");
      expect(queries![0].children[0].children.length).toEqual(2);
      expect(queries![0].children[0].children[0].name).toEqual(
        "dir2 / dir3 / dir3",
      );
      expect(queries![0].children[0].children[0].children.length).toEqual(1);
      expect(queries![0].children[0].children[0].children[0].name).toEqual(
        "query2.ql",
      );
      expect(queries![0].children[0].children[1].name).toEqual("query1.ql");
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

      const resolveQueryByLanguage = mockResolveQueryByLanguage((queryDir) => {
        const workspaceIndex = workspaceRoots.indexOf(queryDir);
        if (workspaceIndex === -1) {
          throw new Error("Unexpected workspace");
        }
        return {
          byLanguage: {
            java: [join(queryDir, `query${workspaceIndex + 1}.ql`)],
          },
        };
      });
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueryByLanguage,
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      await discovery.refresh();
      const queries = discovery.queries;
      expect(queries).toBeDefined();

      expect(queries!.length).toEqual(3);
      expect(queries![0].children[0].name).toEqual("query1.ql");
      expect(queries![1].children[0].name).toEqual("query2.ql");
      expect(queries![2].children[0].name).toEqual("query3.ql");

      expect(resolveQueryByLanguage).toHaveBeenCalledTimes(3);
    });

    it("merges together all queries from QueryInfoByLanguage", async () => {
      const cli = mockedObject<CodeQLCliServer>({
        resolveQueryByLanguage: mockResolveQueryByLanguage((queryDir) => ({
          byLanguage: {
            java: [join(queryDir, "query1.ql")],
            cpp: [join(queryDir, "query2.ql")],
          },
          multipleDeclaredLanguages: [join(queryDir, "query3.ql")],
          noDeclaredLanguage: [join(queryDir, "query4.ql")],
        })),
      });

      const discovery = new QueryDiscovery(createMockApp({}), cli);
      await discovery.refresh();
      const queries = discovery.queries;
      expect(queries).toBeDefined();

      expect(queries![0].children.length).toEqual(4);
      expect(queries![0].children[0].name).toEqual("query1.ql");
      expect(queries![0].children[1].name).toEqual("query2.ql");
      expect(queries![0].children[2].name).toEqual("query3.ql");
      expect(queries![0].children[3].name).toEqual("query4.ql");
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

      const cli = mockedObject<CodeQLCliServer>({
        resolveQueryByLanguage: mockResolveQueryByLanguage((queryDir) => ({
          byLanguage: {
            java: [join(queryDir, "query1.ql")],
          },
        })),
      });

      const discovery = new QueryDiscovery(
        createMockApp({
          createEventEmitter: () => new EventEmitter(),
        }),
        cli,
      );

      const onDidChangeQueriesSpy = jest.fn();
      discovery.onDidChangeQueries(onDidChangeQueriesSpy);

      await discovery.refresh();

      expect(createFileSystemWatcherSpy).toHaveBeenCalledTimes(2);
      expect(onDidChangeQueriesSpy).toHaveBeenCalledTimes(1);

      onWatcherDidChangeEvent.fire(workspace.workspaceFolders![0].uri);

      await discovery.waitForCurrentRefresh();

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
          resolveQueryByLanguage: mockResolveQueryByLanguage(() => ({})),
        }),
      );

      const onDidChangeQueriesSpy = jest.fn();
      discovery.onDidChangeQueries(onDidChangeQueriesSpy);

      await discovery.refresh();

      expect(onDidChangeQueriesSpy).toHaveBeenCalledTimes(1);

      onDidChangeWorkspaceFoldersEvent.fire({ added: [], removed: [] });

      await discovery.waitForCurrentRefresh();

      expect(onDidChangeQueriesSpy).toHaveBeenCalledTimes(2);
    });
  });
});
