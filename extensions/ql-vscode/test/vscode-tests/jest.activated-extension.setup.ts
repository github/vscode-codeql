import { env } from "vscode";
import { beforeEachAction as testConfigBeforeEachAction } from "./test-config";
import type { DirResult } from "tmp";
import { dirSync } from "tmp";
import { realpathSync } from "fs-extra";
import {
  getActivatedExtension,
  setStoragePath,
  storagePath,
} from "./global.helper";

if (process.env.CI) {
  jest.retryTimes(3, {
    logErrorsBeforeRetry: true,
  });
}

// create an extension storage location
let removeStorage: DirResult["removeCallback"] | undefined;

export async function beforeAllAction() {
  // Create the temp directory to be used as extension local storage.
  const dir = dirSync({
    unsafeCleanup: true,
  });
  let storagePath = realpathSync(dir.name);
  if (storagePath.substring(0, 2).match(/[A-Z]:/)) {
    storagePath =
      storagePath.substring(0, 1).toLocaleLowerCase() +
      storagePath.substring(1);
  }
  setStoragePath(storagePath);

  removeStorage = dir.removeCallback;

  // Activate the extension
  await getActivatedExtension();
}

export async function beforeEachAction() {
  jest.spyOn(env, "openExternal").mockResolvedValue(false);

  await testConfigBeforeEachAction();
}

export async function afterAllAction() {
  // ensure temp directory is cleaned up
  try {
    removeStorage?.();
  } catch (e) {
    // we are exiting anyway so don't worry about it.
    // most likely the directory this is a test on Windows and some files are locked.
    console.warn(`Failed to remove storage directory '${storagePath}': ${e}`);
  }
}
