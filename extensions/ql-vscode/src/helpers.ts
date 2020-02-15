import * as path from 'path';
import { CancellationToken, ExtensionContext, ProgressOptions, window as Window, workspace } from 'vscode';
import { logger } from './logging';
import { QueryInfo } from './run-queries';

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

/**
 * This mediates between the kind of progress callbacks we want to
 * write (where we *set* current progress position and give
 * `maxSteps`) and the kind vscode progress api expects us to write
 * (which increment progress by a certain amount out of 100%)
 */
export function withProgress<R>(
  options: ProgressOptions,
  task: (
    progress: (p: ProgressUpdate) => void,
    token: CancellationToken
  ) => Thenable<R>
): Thenable<R> {
  let progressAchieved = 0;
  return Window.withProgress(options,
    (progress, token) => {
      return task(p => {
        const { message, step, maxStep } = p;
        const increment = 100 * (step - progressAchieved) / maxStep;
        progressAchieved = step;
        progress.report({ message, increment });
      }, token);
    });
}

/**
 * Show an error message and log it to the console
 *
 * @param message The message to show.
 * @param items A set of items that will be rendered as actions in the message.
 *
 * @return A thenable that resolves to the selected item or undefined when being dismissed.
 */
export function showAndLogErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  logger.log(message);
  return Window.showErrorMessage(message, ...items);
}
/**
 * Show a warning message and log it to the console
 *
 * @param message The message to show.
 * @param items A set of items that will be rendered as actions in the message.
 *
 * @return A thenable that resolves to the selected item or undefined when being dismissed.
 */
export function showAndLogWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  logger.log(message);
  return Window.showWarningMessage(message, ...items);
}
/**
 * Show an information message and log it to the console
 *
 * @param message The message to show.
 * @param items A set of items that will be rendered as actions in the message.
 *
 * @return A thenable that resolves to the selected item or undefined when being dismissed.
 */
export function showAndLogInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
  logger.log(message);
  return Window.showInformationMessage(message, ...items);
}

/**
 * Opens a modal dialog for the user to make a yes/no choice.
 * @param message The message to show.
 *
 * @return `true` if the user clicks 'Yes', `false` if the user clicks 'No' or cancels the dialog.
 */
export async function showBinaryChoiceDialog(message: string): Promise<boolean> {
  const yesItem = { title: 'Yes', isCloseAffordance: false };
  const noItem = { title: 'No', isCloseAffordance: true }
  const chosenItem = await Window.showInformationMessage(message, { modal: true }, yesItem, noItem);
  return chosenItem === yesItem;
}

/**
 * Show an information message with a customisable action.
 * @param message The message to show.
 * @param actionMessage The call to action message.
 *
 * @return `true` if the user clicks the action, `false` if the user cancels the dialog.
 */
export async function showInformationMessageWithAction(message: string, actionMessage: string): Promise<boolean> {
  const actionItem = { title: actionMessage, isCloseAffordance: false };
  const chosenItem = await Window.showInformationMessage(message, actionItem);
  return chosenItem === actionItem;
}

/** Gets all active workspace folders that are on the filesystem. */
export function getOnDiskWorkspaceFolders() {
  const workspaceFolders = workspace.workspaceFolders || [];
  let diskWorkspaceFolders: string[] = [];
  for (const workspaceFolder of workspaceFolders) {
    if (workspaceFolder.uri.scheme === "file")
      diskWorkspaceFolders.push(workspaceFolder.uri.fsPath)
  }
  return diskWorkspaceFolders;
}

/**
 * Gets a human-readable name for an evaluated query.
 * Uses metadata if it exists, and defaults to the query file name.
 */
export function getQueryName(query: QueryInfo) {
  // Queries run through quick evaluation are not usually the entire query file.
  // Label them differently and include the line numbers.
  if (query.quickEvalPosition !== undefined) {
    const { line, endLine, fileName } = query.quickEvalPosition;
    const lineInfo = line === endLine ? `${line}` : `${line}-${endLine}`;
    return `Quick evaluation of ${path.basename(fileName)}:${lineInfo}`;
  } else if (query.metadata && query.metadata.name) {
    return query.metadata.name;
  } else {
    return path.basename(query.program.queryPath);
  }
}

/**
 * Provides a utility method to invoke a function only if a minimum time interval has elapsed since
 * the last invocation of that function.
 */
export class InvocationRateLimiter<T> {
  constructor(
    extensionContext: ExtensionContext,
    funcIdentifier: string,
    func: () => Promise<T>,
    createDate: (dateString?: string) => Date = s => s ? new Date(s) : new Date()) {
    this._createDate = createDate;
    this._extensionContext = extensionContext;
    this._func = func;
    this._funcIdentifier = funcIdentifier;
  }

  /**
   * Invoke the function if `minSecondsSinceLastInvocation` seconds have elapsed since the last invocation.
   */
  public async invokeFunctionIfIntervalElapsed(minSecondsSinceLastInvocation: number): Promise<InvocationRateLimiterResult<T>> {
    const updateCheckStartDate = this._createDate();
    const lastInvocationDate = this.getLastInvocationDate();
    if (minSecondsSinceLastInvocation && lastInvocationDate && lastInvocationDate <= updateCheckStartDate &&
      lastInvocationDate.getTime() + minSecondsSinceLastInvocation * 1000 > updateCheckStartDate.getTime()) {
      return createRateLimitedResult();
    }
    const result = await this._func();
    await this.setLastInvocationDate(updateCheckStartDate);
    return createInvokedResult(result);
  }

  private getLastInvocationDate(): Date | undefined {
    const maybeDateString: string | undefined =
      this._extensionContext.globalState.get(InvocationRateLimiter._invocationRateLimiterPrefix + this._funcIdentifier);
    return maybeDateString ? this._createDate(maybeDateString) : undefined;
  }

  private async setLastInvocationDate(date: Date): Promise<void> {
    return await this._extensionContext.globalState.update(InvocationRateLimiter._invocationRateLimiterPrefix + this._funcIdentifier, date);
  }

  private readonly _createDate: (dateString?: string) => Date;
  private readonly _extensionContext: ExtensionContext;
  private readonly _func: () => Promise<T>;
  private readonly _funcIdentifier: string;

  private static readonly _invocationRateLimiterPrefix = "invocationRateLimiter_lastInvocationDate_";
}

export enum InvocationRateLimiterResultKind {
  Invoked,
  RateLimited
}

/**
 * The function was invoked and returned the value `result`.
 */
interface InvokedResult<T> {
  kind: InvocationRateLimiterResultKind.Invoked,
  result: T
}

/**
 * The function was not invoked as the minimum interval since the last invocation had not elapsed.
 */
interface RateLimitedResult {
  kind: InvocationRateLimiterResultKind.RateLimited
}

type InvocationRateLimiterResult<T> = InvokedResult<T> | RateLimitedResult;

function createInvokedResult<T>(result: T): InvokedResult<T> {
  return {
    kind: InvocationRateLimiterResultKind.Invoked,
    result
  };
}

function createRateLimitedResult(): RateLimitedResult {
  return {
    kind: InvocationRateLimiterResultKind.RateLimited
  };
}
