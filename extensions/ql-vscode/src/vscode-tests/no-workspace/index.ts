import "source-map-support/register";
import * as sinonChai from "sinon-chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import "chai/register-should";
import { ExtensionContext } from "vscode";

import { runTestsInDirectory } from "../index-template";

chai.use(chaiAsPromised);
chai.use(sinonChai);

export function run(): Promise<void> {
  return runTestsInDirectory(__dirname);
}

export function createMockExtensionContext(): ExtensionContext {
  return {
    globalState: {
      _state: {
        "telemetry-request-viewed": true,
      } as Record<string, any>,
      get(key: string) {
        return this._state[key];
      },
      update(key: string, val: any) {
        this._state[key] = val;
      },
    },
  } as any;
}
