import type {
  CancellationToken,
  ProgressOptions as VSCodeProgressOptions,
} from "vscode";
import { ProgressLocation, window as Window } from "vscode";
import { readableBytesMb } from "../bytes";

export class UserCancellationException extends Error {
  /**
   * @param message The error message
   * @param silent If silent is true, then this exception will avoid showing a warning message to the user.
   */
  constructor(
    message?: string,
    public readonly silent = false,
  ) {
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

export function progressUpdate(
  step: number,
  maxStep: number,
  message: string,
): ProgressUpdate {
  return { step, maxStep, message };
}

export type ProgressCallback = (p: ProgressUpdate) => void;

// Make certain properties within a type optional
type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

type ProgressOptions = Optional<VSCodeProgressOptions, "location">;

/**
 * A task that reports progress.
 *
 * @param progress a progress handler function. Call this
 * function with a `ProgressUpdate` instance in order to
 * denote some progress being achieved on this task.
 * @param token a cancellation token
 */
type ProgressTask<R> = (
  progress: ProgressCallback,
  token: CancellationToken,
) => Thenable<R>;

/**
 * This mediates between the kind of progress callbacks we want to
 * write (where we *set* current progress position and give
 * `maxSteps`) and the kind vscode progress api expects us to write
 * (which increment progress by a certain amount out of 100%).
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
 * Displays a progress monitor that indicates how much progess has been made
 * reading from a stream.
 *
 * @param messagePrefix A prefix for displaying the message
 * @param totalNumBytes Total number of bytes in this stream
 * @param progress The progress callback used to set messages
 */
export function reportStreamProgress(
  messagePrefix: string,
  totalNumBytes?: number,
  progress?: ProgressCallback,
): (bytesRead: number) => void {
  if (progress && totalNumBytes) {
    let numBytesDownloaded = 0;
    const updateProgress = () => {
      progress({
        step: numBytesDownloaded,
        maxStep: totalNumBytes,
        message: `${messagePrefix} [${readableBytesMb(
          numBytesDownloaded,
        )} of ${readableBytesMb(totalNumBytes)}]`,
      });
    };

    // Display the progress straight away rather than waiting for the first chunk.
    updateProgress();

    return (bytesRead: number) => {
      numBytesDownloaded += bytesRead;
      updateProgress();
    };
  } else if (progress) {
    progress({
      step: 1,
      maxStep: 2,
      message: `${messagePrefix} (Size unknown)`,
    });
  }

  return () => {};
}
