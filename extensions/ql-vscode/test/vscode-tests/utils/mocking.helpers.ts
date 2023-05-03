import { QuickPickItem, window, Uri } from "vscode";
import { DatabaseItem } from "../../../src/databases/local-databases";

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type DynamicProperties<T extends object> = {
  [P in keyof T]?: () => T[P];
};

type MockedObjectOptions<T extends object> = {
  /**
   * Properties for which the given method should be called when accessed.
   * The method should return the value to be returned when the property is accessed.
   * Methods which are explicitly defined in `methods` will take precedence over
   * dynamic properties.
   */
  dynamicProperties?: DynamicProperties<T>;
};

export function mockedObject<T extends object>(
  props: DeepPartial<T>,
  { dynamicProperties }: MockedObjectOptions<T> = {},
): T {
  return new Proxy<T>({} as unknown as T, {
    get: (_target, prop) => {
      if (prop in props) {
        return (props as any)[prop];
      }
      if (dynamicProperties && prop in dynamicProperties) {
        return (dynamicProperties as any)[prop]();
      }

      // The `then` method is accessed by `Promise.resolve` to check if the object is a thenable.
      // We don't want to throw an error when this happens.
      if (prop === "then") {
        return undefined;
      }

      throw new Error(`Method ${String(prop)} not mocked`);
    },
  });
}

export function mockDatabaseItem(
  props: DeepPartial<DatabaseItem> = {},
): DatabaseItem {
  return mockedObject<DatabaseItem>({
    databaseUri: Uri.file("abc"),
    name: "github/codeql",
    language: "javascript",
    sourceArchive: undefined,
    resolveSourceFile: jest.fn().mockReturnValue(Uri.file("abc")),
    ...props,
  });
}

export function mockedQuickPickItem<T extends QuickPickItem | string>(
  value: T | T[],
): Awaited<ReturnType<typeof window.showQuickPick>> {
  return value as Awaited<ReturnType<typeof window.showQuickPick>>;
}
