import { readdirSync, readFileSync } from "fs-extra";
import { join } from "path";
import * as tmp from "tmp";
import { Logger, OutputChannelLogger, TeeLogger } from "../../../src/common";

jest.setTimeout(999999);

jest.mock(
  "vscode",
  () => {
    const mockOutputChannel = {
      append: jest.fn(),
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn(),
    };

    return {
      window: {
        createOutputChannel: () => mockOutputChannel,
      },
      mockOutputChannel,
    };
  },
  {
    virtual: true,
  },
);

describe("OutputChannelLogger tests", function () {
  const tempFolders: Record<string, tmp.DirResult> = {};
  let logger: any;

  beforeEach(async () => {
    tempFolders.globalStoragePath = tmp.dirSync({
      prefix: "logging-tests-global",
    });
    tempFolders.storagePath = tmp.dirSync({
      prefix: "logging-tests-workspace",
    });
    logger = new OutputChannelLogger("test-logger");
  });

  afterEach(() => {
    tempFolders.globalStoragePath.removeCallback();
    tempFolders.storagePath.removeCallback();
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mockOutputChannel = require("vscode").mockOutputChannel;

  it("should log to the output channel", async () => {
    await logger.log("xxx");
    expect(mockOutputChannel.appendLine).toBeCalledWith("xxx");
    expect(mockOutputChannel.append).not.toBeCalledWith("xxx");

    await logger.log("yyy", { trailingNewline: false });
    expect(mockOutputChannel.appendLine).not.toBeCalledWith("yyy");
    expect(mockOutputChannel.append).toBeCalledWith("yyy");

    const hucairz = createSideLogger(logger, "hucairz");
    await hucairz.log("zzz");

    // should have created 1 side log
    expect(readdirSync(tempFolders.storagePath.name)).toEqual(["hucairz"]);
  });

  it("should create a side log", async () => {
    const first = createSideLogger(logger, "first");
    await first.log("xxx");
    const second = createSideLogger(logger, "second");
    await second.log("yyy");
    await first.log("zzz", { trailingNewline: false });
    await logger.log("aaa");

    // expect 2 side logs
    expect(readdirSync(tempFolders.storagePath.name).length).toBe(2);

    // contents
    expect(
      readFileSync(join(tempFolders.storagePath.name, "first"), "utf8"),
    ).toBe("xxx\nzzz");
    expect(
      readFileSync(join(tempFolders.storagePath.name, "second"), "utf8"),
    ).toBe("yyy\n");
  });

  function createSideLogger(
    logger: Logger,
    additionalLogLocation: string,
  ): Logger {
    return new TeeLogger(
      logger,
      join(tempFolders.storagePath.name, additionalLogLocation),
    );
  }
});
