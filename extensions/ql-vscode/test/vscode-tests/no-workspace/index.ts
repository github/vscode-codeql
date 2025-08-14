import type { ExtensionContext } from "vscode";

export function createMockExtensionContext(): ExtensionContext {
  return {
    globalState: {
      _state: {} as Record<string, any>,
      get<T>(key: string): T | undefined {
        return this._state[key] as T | undefined;
      },
      update(key: string, val: any) {
        this._state[key] = val;
      },
    },
  } as unknown as ExtensionContext;
}
