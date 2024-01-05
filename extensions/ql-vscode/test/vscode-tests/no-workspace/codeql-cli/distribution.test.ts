import * as log from "../../../../src/common/logging/notifications";
import { extLogger } from "../../../../src/common/logging/vscode";
import { writeFile } from "fs-extra";
import { join } from "path";
import * as os from "os";
import type { DirectoryResult } from "tmp-promise";
import { dir } from "tmp-promise";
import {
  DistributionManager,
  getExecutableFromDirectory,
} from "../../../../src/codeql-cli/distribution";
import type {
  showAndLogErrorMessage,
  showAndLogWarningMessage,
} from "../../../../src/common/logging";

jest.mock("os", () => {
  const original = jest.requireActual("os");
  return {
    ...original,
    platform: jest.fn(),
  };
});

const mockedOS = jest.mocked(os);

describe("Launcher path", () => {
  let warnSpy: jest.SpiedFunction<typeof showAndLogWarningMessage>;
  let errorSpy: jest.SpiedFunction<typeof showAndLogErrorMessage>;
  let logSpy: jest.SpiedFunction<typeof extLogger.log>;

  let directory: DirectoryResult;

  let pathToCmd: string;
  let pathToExe: string;

  beforeEach(async () => {
    warnSpy = jest
      .spyOn(log, "showAndLogWarningMessage")
      .mockResolvedValue(undefined);
    errorSpy = jest
      .spyOn(log, "showAndLogErrorMessage")
      .mockResolvedValue(undefined);
    logSpy = jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    mockedOS.platform.mockReturnValue("win32");

    directory = await dir({
      unsafeCleanup: true,
    });

    pathToCmd = join(directory.path, "codeql.cmd");
    pathToExe = join(directory.path, "codeql.exe");
  });

  afterEach(async () => {
    await directory.cleanup();
  });

  it("should not warn with proper launcher name", async () => {
    await writeFile(pathToExe, "");

    const result = await getExecutableFromDirectory(directory.path);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // No log message
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBe(pathToExe);
  });

  it("should warn when using a hard-coded deprecated launcher name", async () => {
    await writeFile(pathToCmd, "");

    const result = await getExecutableFromDirectory(directory.path);

    // Should have opened a warning message
    expect(warnSpy).toHaveBeenCalled();
    // No log message
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBe(pathToCmd);
  });

  it("should avoid warn when no launcher is found", async () => {
    const result = await getExecutableFromDirectory(directory.path, false);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // log message sent out
    expect(logSpy).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should warn when no launcher is found", async () => {
    const result = await getExecutableFromDirectory("abc", true);

    // no warning message
    expect(warnSpy).not.toHaveBeenCalled();
    // log message sent out
    expect(logSpy).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should not warn when deprecated launcher is used, but no new launcher is available", async function () {
    await writeFile(pathToCmd, "");

    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      {} as any,
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBe(pathToCmd);

    // no warning or error message
    expect(warnSpy).toBeCalledTimes(0);
    expect(errorSpy).toBeCalledTimes(0);
  });

  it("should warn when deprecated launcher is used, and new launcher is available", async () => {
    await writeFile(pathToCmd, "");
    await writeFile(pathToExe, "");

    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      {} as any,
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBe(pathToCmd);

    // has warning message
    expect(warnSpy).toBeCalledTimes(1);
    expect(errorSpy).toBeCalledTimes(0);
  });

  it("should warn when launcher path is incorrect", async () => {
    const manager = new DistributionManager(
      { customCodeQlPath: pathToCmd } as any,
      {} as any,
      {} as any,
    );

    const result = await manager.getCodeQlPathWithoutVersionCheck();
    expect(result).toBeUndefined();

    // no error message
    expect(warnSpy).toBeCalledTimes(0);
    expect(errorSpy).toBeCalledTimes(1);
  });
});
