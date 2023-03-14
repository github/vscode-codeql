import {
  CancellationToken,
  ProgressOptions as VSCodeProgressOptions,
  window as Window,
  commands,
  Disposable,
  ProgressLocation,
} from "vscode";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
} from "./helpers";
import { extLogger } from "./common";
import { asError, getErrorMessage, getErrorStack } from "./pure/helpers-pure";
import { telemetryListener } from "./telemetry";
import { redactableError } from "./pure/errors";

export class UserCancellationException extends Error {
  /**
   * @param message The error message
   * @param silent If silent is true, then this exception will avoid showing a warning message to the user.
   */
  constructor(message?: string, public readonly silent = false) {
    super(message);
  }
}

export interface ProgressUpdate {
  /**
   * The current step
   */
  step: number;
  /**
   * The maximum step. This *should* be constant for a single job.
   */
  maxStep: number;
  /**
   * The current progress message
   */
  message: string;
}

export type ProgressCallback = (p: ProgressUpdate) => void;

// Make certain properties within a type optional
type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export type ProgressOptions = Optional<VSCodeProgressOptions, "location">;

/**
 * A task that reports progress.
 *
 * @param progress a progress handler function. Call this
 * function with a `ProgressUpdate` instance in order to
 * denote some progress being achieved on this task.
 * @param token a cancellation token
 */
export type ProgressTask<R> = (
  progress: ProgressCallback,
  token: CancellationToken,
) => Thenable<R>;

/**
 * A task that handles command invocations from `commandRunner`
 * and includes a progress monitor.
 *
 *
 * Arguments passed to the command handler are passed along,
 * untouched to this `ProgressTaskWithArgs` instance.
 *
 * @param progress a progress handler function. Call this
 * function with a `ProgressUpdate` instance in order to
 * denote some progress being achieved on this task.
 * @param token a cancellation token
 * @param args arguments passed to this task passed on from
 * `commands.registerCommand`.
 */
export type ProgressTaskWithArgs<R> = (
  progress: ProgressCallback,
  token: CancellationToken,
  ...args: any[]
) => Thenable<R>;

/**
 * A task that handles command invocations from `commandRunner`.
 * Arguments passed to the command handler are passed along,
 * untouched to this `NoProgressTask` instance.
 *
 * @param args arguments passed to this task passed on from
 * `commands.registerCommand`.
 */
type NoProgressTask = (...args: any[]) => Promise<any>;

/**
 * This mediates between the kind of progress callbacks we want to
 * write (where we *set* current progress position and give
 * `maxSteps`) and the kind vscode progress api expects us to write
 * (which increment progress by a certain amount out of 100%).
 *
 * Where possible, the `commandRunner` function below should be used
 * instead of this function. The commandRunner is meant for wrapping
 * top-level commands and provides error handling and other support
 * automatically.
 *
 * Only use this function if you need a progress monitor and the
 * control flow does not always come from a command (eg- during
 * extension activation, or from an internal language server
 * request).
 */
export function withProgress<R>(
  task: ProgressTask<R>,
  {
    location = ProgressLocation.Notification,
    title,
    cancellable,
  }: ProgressOptions = {},
): Thenable<R> {
  let progressAchieved = 0;
  return Window.withProgress(
    {
      location,
      title,
      cancellable,
    },
    (progress, token) => {
      return task((p) => {
        const { message, step, maxStep } = p;
        const increment = (100 * (step - progressAchieved)) / maxStep;
        progressAchieved = step;
        progress.report({ message, increment });
      }, token);
    },
  );
}

/**
 * A generic wrapper for command registration. This wrapper adds uniform error handling for commands.
 *
 * In this variant of the command runner, no progress monitor is used.
 *
 * @param commandId The ID of the command to register.
 * @param task The task to run. It is passed directly to `commands.registerCommand`. Any
 * arguments to the command handler are passed on to the task.
 */
export function commandRunner(
  commandId: string,
  task: NoProgressTask,
  outputLogger = extLogger,
): Disposable {
  return commands.registerCommand(commandId, async (...args: any[]) => {
    const startTime = Date.now();
    let error: Error | undefined;

    try {
      return await task(...args);
    } catch (e) {
      error = asError(e);
      const errorMessage = redactableError(error)`${
        getErrorMessage(e) || e
      } (${commandId})`;
      const errorStack = getErrorStack(e);
      if (e instanceof UserCancellationException) {
        // User has cancelled this action manually
        if (e.silent) {
          void outputLogger.log(errorMessage.fullMessage);
        } else {
          void showAndLogWarningMessage(errorMessage.fullMessage, {
            outputLogger,
          });
        }
      } else {
        // Include the full stack in the error log only.
        const fullMessage = errorStack
          ? `${errorMessage.fullMessage}\n${errorStack}`
          : errorMessage.fullMessage;
        void showAndLogExceptionWithTelemetry(errorMessage, {
          outputLogger,
          fullMessage,
          extraTelemetryProperties: {
            command: commandId,
          },
        });
      }
      return undefined;
    } finally {
      const executionTime = Date.now() - startTime;
      telemetryListener?.sendCommandUsage(commandId, executionTime, error);
    }
  });
}

/**
 * A generic wrapper for command registration.  This wrapper adds uniform error handling,
 * progress monitoring, and cancellation for commands.
 *
 * @param commandId The ID of the command to register.
 * @param task The task to run. It is passed directly to `commands.registerCommand`. Any
 * arguments to the command handler are passed on to the task after the progress callback
 * and cancellation token.
 * @param progressOptions Progress options to be sent to the progress monitor.
 */
export function commandRunnerWithProgress<R>(
  commandId: string,
  task: ProgressTaskWithArgs<R>,
  progressOptions: ProgressOptions,
  outputLogger = extLogger,
): Disposable {
  return commandRunner(
    commandId,
    async (...args: any[]) => {
      return withProgress(
        (progress, token) => task(progress, token, ...args),
        progressOptions,
      );
    },
    outputLogger,
  );
}

/**
 * Displays a progress monitor that indicates how much progess has been made
 * reading from a stream.
 *
 * @param readable The stream to read progress from
 * @param messagePrefix A prefix for displaying the message
 * @param totalNumBytes Total number of bytes in this stream
 * @param progress The progress callback used to set messages
 */
export function reportStreamProgress(
  readable: NodeJS.ReadableStream,
  messagePrefix: string,
  totalNumBytes?: number,
  progress?: ProgressCallback,
) {
  if (progress && totalNumBytes) {
    let numBytesDownloaded = 0;
    const bytesToDisplayMB = (numBytes: number): string =>
      `${(numBytes / (1024 * 1024)).toFixed(1)} MB`;
    const updateProgress = () => {
      progress({
        step: numBytesDownloaded,
        maxStep: totalNumBytes,
        message: `${messagePrefix} [${bytesToDisplayMB(
          numBytesDownloaded,
        )} of ${bytesToDisplayMB(totalNumBytes)}]`,
      });
    };

    // Display the progress straight away rather than waiting for the first chunk.
    updateProgress();

    readable.on("data", (data) => {
      numBytesDownloaded += data.length;
      updateProgress();
    });
  } else if (progress) {
    progress({
      step: 1,
      maxStep: 2,
      message: `${messagePrefix} (Size unknown)`,
    });
  }
}
