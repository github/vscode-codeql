import {
  CancellationToken,
  ProgressOptions,
  window as Window,
  commands,
  Disposable,
  ProgressLocation
} from 'vscode';
import { showAndLogErrorMessage, showAndLogWarningMessage } from './helpers';
import { logger } from './logging';
import { telemetryListener } from './telemetry';

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

/**
 * A task that handles command invocations from `commandRunner`
 * and includes a progress monitor.
 *
 *
 * Arguments passed to the command handler are passed along,
 * untouched to this `ProgressTask` instance.
 *
 * @param progress a progress handler function. Call this
 * function with a `ProgressUpdate` instance in order to
 * denote some progress being achieved on this task.
 * @param token a cencellation token
 * @param args arguments passed to this task passed on from
 * `commands.registerCommand`.
 */
export type ProgressTask<R> = (
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
type NoProgressTask = ((...args: any[]) => Promise<any>);

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
  options: ProgressOptions,
  task: ProgressTask<R>,
  ...args: any[]
): Thenable<R> {
  let progressAchieved = 0;
  return Window.withProgress(options,
    (progress, token) => {
      return task(p => {
        const { message, step, maxStep } = p;
        const increment = 100 * (step - progressAchieved) / maxStep;
        progressAchieved = step;
        progress.report({ message, increment });
      }, token, ...args);
    });
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
): Disposable {
  return commands.registerCommand(commandId, async (...args: any[]) => {
    const startTIme = Date.now();
    let error: Error | undefined;

    try {
      await task(...args);
    } catch (e) {
      error = e;
      if (e instanceof UserCancellationException) {
        // User has cancelled this action manually
        if (e.silent) {
          logger.log(e.message);
        } else {
          showAndLogWarningMessage(e.message);
        }
      } else {
        showAndLogErrorMessage(e.message || e);
      }
    } finally {
      const executionTime = Date.now() - startTIme;
      telemetryListener.sendCommandUsage(commandId, executionTime, error);
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
  task: ProgressTask<R>,
  progressOptions: Partial<ProgressOptions>
): Disposable {
  return commands.registerCommand(commandId, async (...args: any[]) => {
    const startTIme = Date.now();
    let error: Error | undefined;
    const progressOptionsWithDefaults = {
      location: ProgressLocation.Notification,
      ...progressOptions
    };
    try {
      await withProgress(progressOptionsWithDefaults, task, ...args);
    } catch (e) {
      error = e;
      if (e instanceof UserCancellationException) {
        // User has cancelled this action manually
        if (e.silent) {
          logger.log(e.message);
        } else {
          showAndLogWarningMessage(e.message);
        }
      } else {
        showAndLogErrorMessage(e.message || e);
      }
    } finally {
      const executionTime = Date.now() - startTIme;
      telemetryListener.sendCommandUsage(commandId, executionTime, error);
    }
  });
}
