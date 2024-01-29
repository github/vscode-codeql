import { asError, getErrorMessage } from "../common/helpers-pure";

// https://docs.github.com/en/code-security/codeql-cli/using-the-advanced-functionality-of-the-codeql-cli/exit-codes
const EXIT_CODE_USER_ERROR = 2;
const EXIT_CODE_CANCELLED = 98;

export class ExitCodeError extends Error {
  constructor(public readonly exitCode: number | null) {
    super(`Process exited with code ${exitCode}`);
  }
}

export class CliError extends Error {
  constructor(
    message: string,
    public readonly stderr: string | undefined,
    public readonly cause: Error,
    public readonly commandDescription: string,
    public readonly commandArgs: string[],
  ) {
    super(message);
  }
}

export function getCliError(
  e: unknown,
  stderr: string | undefined,
  commandDescription: string,
  commandArgs: string[],
): CliError {
  const error = asError(e);

  if (!(error instanceof ExitCodeError) || !stderr) {
    return formatCliErrorFallback(
      error,
      stderr,
      commandDescription,
      commandArgs,
    );
  }

  switch (error.exitCode) {
    case EXIT_CODE_USER_ERROR: {
      // This is an error that we should try to format nicely
      const fatalErrorIndex = stderr.lastIndexOf("A fatal error occurred: ");
      if (fatalErrorIndex !== -1) {
        return new CliError(
          stderr.slice(fatalErrorIndex),
          stderr,
          error,
          commandDescription,
          commandArgs,
        );
      }

      break;
    }
    case EXIT_CODE_CANCELLED: {
      const cancellationIndex = stderr.lastIndexOf(
        "Computation was cancelled: ",
      );
      if (cancellationIndex !== -1) {
        return new CliError(
          stderr.slice(cancellationIndex),
          stderr,
          error,
          commandDescription,
          commandArgs,
        );
      }

      break;
    }
  }

  return formatCliErrorFallback(error, stderr, commandDescription, commandArgs);
}

function formatCliErrorFallback(
  error: Error,
  stderr: string | undefined,
  commandDescription: string,
  commandArgs: string[],
): CliError {
  if (stderr) {
    return new CliError(
      stderr,
      undefined,
      error,
      commandDescription,
      commandArgs,
    );
  }

  return new CliError(
    getErrorMessage(error),
    undefined,
    error,
    commandDescription,
    commandArgs,
  );
}
