import type { ExtensionContext } from "vscode";

export function createMockExtensionContext(): ExtensionContext {
  return {
    globalState: {
      _state: {} as Record<string, any>,
      get(key: string) {
        return this._state[key];
      },
      update(key: string, val: any) {
        this._state[key] = val;
      },
    },
  } as any;
}
