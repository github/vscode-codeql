import type { QuickPickItem, window, Uri } from "vscode";
import type { DatabaseItem } from "../../../src/databases/local-databases";
import type { Octokit } from "@octokit/rest";

import type { DeepPartial } from "../../mocked-object";
import { mockedObject } from "../../mocked-object";

export { mockedObject };
export type { DeepPartial };

export function mockedOctokitFunction<
  Namespace extends keyof Octokit["rest"],
  Name extends keyof Octokit["rest"][Namespace],
>(): Octokit["rest"][Namespace][Name] & jest.Mock {
  const fn = jest.fn();
  return fn as unknown as Octokit["rest"][Namespace][Name] & jest.Mock;
}

export function mockDatabaseItem(
  props: DeepPartial<DatabaseItem> = {},
): DatabaseItem {
  return mockedObject<DatabaseItem>({
    databaseUri: mockedUri("abc"),
    name: "github/codeql",
    language: "javascript",
    sourceArchive: undefined,
    resolveSourceFile: jest.fn().mockReturnValue(mockedUri("abc")),
    ...props,
  });
}

export function mockedQuickPickItem<T extends QuickPickItem | string>(
  value: T | T[],
): Awaited<ReturnType<typeof window.showQuickPick>> {
  return value as Awaited<ReturnType<typeof window.showQuickPick>>;
}

export function mockedUri(path = "/a/b/c/foo"): Uri {
  return {
    scheme: "file",
    authority: "",
    path,
    query: "",
    fragment: "",
    fsPath: path,
    with: jest.fn(),
    toJSON: jest.fn(),
  };
}
