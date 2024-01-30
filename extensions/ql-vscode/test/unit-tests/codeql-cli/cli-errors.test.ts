import {
  CliError,
  ExitCodeError,
  getCliError,
} from "../../../src/codeql-cli/cli-errors";
import { EOL } from "os";

describe("getCliError", () => {
  it("returns an error with an unknown error", () => {
    const error = new Error("foo");

    expect(getCliError(error, undefined, "bar", ["baz"])).toEqual(
      new CliError("foo", undefined, error, "bar", ["baz"]),
    );
  });

  it("returns an error with an unknown error with stderr", () => {
    const error = new Error("foo");

    expect(getCliError(error, "Something failed", "bar", ["baz"])).toEqual(
      new CliError("Something failed", "Something failed", error, "bar", [
        "baz",
      ]),
    );
  });

  it("returns an error with an unknown error with stderr", () => {
    const error = new Error("foo");

    expect(getCliError(error, "Something failed", "bar", ["baz"])).toEqual(
      new CliError("Something failed", "Something failed", error, "bar", [
        "baz",
      ]),
    );
  });

  it("returns an error with an exit code error with unhandled exit code", () => {
    const error = new ExitCodeError(99); // OOM

    expect(getCliError(error, "OOM!", "bar", ["baz"])).toEqual(
      new CliError("OOM!", "OOM!", error, "bar", ["baz"]),
    );
  });

  it("returns an error with an exit code error with handled exit code without string", () => {
    const error = new ExitCodeError(2);

    expect(getCliError(error, "Something happened!", "bar", ["baz"])).toEqual(
      new CliError("Something happened!", "Something happened!", error, "bar", [
        "baz",
      ]),
    );
  });

  it("returns an error with a user code error with identifying string", () => {
    const error = new ExitCodeError(2);
    const stderr = `Something happened!${EOL}A fatal error occurred: The query did not run successfully.${EOL}The correct columns were not present.`;

    expect(getCliError(error, stderr, "bar", ["baz"])).toEqual(
      new CliError(
        `A fatal error occurred: The query did not run successfully.${EOL}The correct columns were not present.`,
        stderr,
        error,
        "bar",
        ["baz"],
      ),
    );
  });

  it("returns an error with a user code error with cancelled string", () => {
    const error = new ExitCodeError(2);
    const stderr = `Running query...${EOL}Something is happening...${EOL}Computation was cancelled: Cancelled by user`;

    expect(getCliError(error, stderr, "bar", ["baz"])).toEqual(
      new CliError(stderr, stderr, error, "bar", ["baz"]),
    );
  });

  it("returns an error with a cancelled error with identifying string", () => {
    const error = new ExitCodeError(98);
    const stderr = `Running query...${EOL}Something is happening...${EOL}Computation was cancelled: Cancelled by user`;

    expect(getCliError(error, stderr, "bar", ["baz"])).toEqual(
      new CliError(
        "Computation was cancelled: Cancelled by user",
        stderr,
        error,
        "bar",
        ["baz"],
      ),
    );
  });
});
