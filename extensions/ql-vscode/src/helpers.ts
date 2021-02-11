import * as fs from 'fs-extra';
import * as glob from 'glob-promise';
import * as yaml from 'js-yaml';
import * as path from 'path';
import {
  ExtensionContext,
  Uri,
  window as Window,
  workspace,
  env
} from 'vscode';
import { CodeQLCliServer } from './cli';
import { logger } from './logging';

/**
 * Show an error message and log it to the console
 *
 * @param message The message to show.
 * @param options.outputLogger The output logger that will receive the message
 * @param options.items A set of items that will be rendered as actions in the message.
 * @param options.fullMessage An alternate message that is added to the log, but not displayed
 *                           in the popup. This is useful for adding extra detail to the logs
 *                           that would be too noisy for the popup.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogErrorMessage(message: string, {
  outputLogger = logger,
  items = [] as string[],
  fullMessage = undefined as (string | undefined)
} = {}): Promise<string | undefined> {
  return internalShowAndLog(message, items, outputLogger, Window.showErrorMessage, fullMessage);
}
/**
 * Show a warning message and log it to the console
 *
 * @param message The message to show.
 * @param options.outputLogger The output logger that will receive the message
 * @param options.items A set of items that will be rendered as actions in the message.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogWarningMessage(message: string, {
  outputLogger = logger,
  items = [] as string[]
} = {}): Promise<string | undefined> {
  return internalShowAndLog(message, items, outputLogger, Window.showWarningMessage);
}
/**
 * Show an information message and log it to the console
 *
 * @param message The message to show.
 * @param options.outputLogger The output logger that will receive the message
 * @param options.items A set of items that will be rendered as actions in the message.
 *
 * @return A promise that resolves to the selected item or undefined when being dismissed.
 */
export async function showAndLogInformationMessage(message: string, {
  outputLogger = logger,
  items = [] as string[]
} = {}): Promise<string | undefined> {
  return internalShowAndLog(message, items, outputLogger, Window.showInformationMessage);
}

type ShowMessageFn = (message: string, ...items: string[]) => Thenable<string | undefined>;

async function internalShowAndLog(
  message: string,
  items: string[],
  outputLogger = logger,
  fn: ShowMessageFn,
  fullMessage?: string
): Promise<string | undefined> {
  const label = 'Show Log';
  outputLogger.log(fullMessage || message);
  const result = await fn(message, label, ...items);
  if (result === label) {
    outputLogger.show();
  }
  return result;
}

/**
 * Opens a modal dialog for the user to make a yes/no choice.
 *
 * @param message The message to show.
 * @param modal If true (the default), show a modal dialog box, otherwise dialog is non-modal and can
 *        be closed even if the user does not make a choice.
 *
 * @return
 *  `true` if the user clicks 'Yes',
 *  `false` if the user clicks 'No' or cancels the dialog,
 *  `undefined` if the dialog is closed without the user making a choice.
 */
export async function showBinaryChoiceDialog(message: string, modal = true): Promise<boolean | undefined> {
  const yesItem = { title: 'Yes', isCloseAffordance: false };
  const noItem = { title: 'No', isCloseAffordance: true };
  const chosenItem = await Window.showInformationMessage(message, { modal }, yesItem, noItem);
  if (!chosenItem) {
    return undefined;
  }
  return chosenItem?.title === yesItem.title;
}

/**
 * Opens a modal dialog for the user to make a yes/no choice.
 *
 * @param message The message to show.
 * @param modal If true (the default), show a modal dialog box, otherwise dialog is non-modal and can
 *        be closed even if the user does not make a choice.
 *
 * @return
 *  `true` if the user clicks 'Yes',
 *  `false` if the user clicks 'No' or cancels the dialog,
 *  `undefined` if the dialog is closed without the user making a choice.
 */
export async function showBinaryChoiceWithUrlDialog(message: string, url: string): Promise<boolean | undefined> {
  const urlItem = { title: 'More Information', isCloseAffordance: false };
  const yesItem = { title: 'Yes', isCloseAffordance: false };
  const noItem = { title: 'No', isCloseAffordance: true };
  let chosenItem;

  // Keep the dialog open as long as the user is clicking the 'more information' option.
  // To prevent an infinite loop, if the user clicks 'more information' 5 times, close the dialog and return cancelled
  let count = 0;
  do {
    chosenItem = await Window.showInformationMessage(message, { modal: true }, urlItem, yesItem, noItem);
    if (chosenItem === urlItem) {
      await env.openExternal(Uri.parse(url, true));
    }
    count++;
  } while (chosenItem === urlItem && count < 5);

  if (!chosenItem || chosenItem.title === urlItem.title) {
    return undefined;
  }
  return chosenItem.title === yesItem.title;
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
  const diskWorkspaceFolders: string[] = [];
  for (const workspaceFolder of workspaceFolders) {
    if (workspaceFolder.uri.scheme === 'file')
      diskWorkspaceFolders.push(workspaceFolder.uri.fsPath);
  }
  return diskWorkspaceFolders;
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
    if (
      minSecondsSinceLastInvocation &&
      lastInvocationDate &&
      lastInvocationDate <= updateCheckStartDate &&
      lastInvocationDate.getTime() + minSecondsSinceLastInvocation * 1000 > updateCheckStartDate.getTime()
    ) {
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

  private static readonly _invocationRateLimiterPrefix = 'invocationRateLimiter_lastInvocationDate_';
}

export enum InvocationRateLimiterResultKind {
  Invoked,
  RateLimited
}

/**
 * The function was invoked and returned the value `result`.
 */
interface InvokedResult<T> {
  kind: InvocationRateLimiterResultKind.Invoked;
  result: T;
}

/**
 * The function was not invoked as the minimum interval since the last invocation had not elapsed.
 */
interface RateLimitedResult {
  kind: InvocationRateLimiterResultKind.RateLimited;
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

export async function getQlPackForDbscheme(cliServer: CodeQLCliServer, dbschemePath: string): Promise<string> {
  const qlpacks = await cliServer.resolveQlpacks(getOnDiskWorkspaceFolders());
  const packs: { packDir: string | undefined; packName: string }[] =
    Object.entries(qlpacks).map(([packName, dirs]) => {
      if (dirs.length < 1) {
        logger.log(`In getQlPackFor ${dbschemePath}, qlpack ${packName} has no directories`);
        return { packName, packDir: undefined };
      }
      if (dirs.length > 1) {
        logger.log(`In getQlPackFor ${dbschemePath}, qlpack ${packName} has more than one directory; arbitrarily choosing the first`);
      }
      return {
        packName,
        packDir: dirs[0]
      };
    });
  for (const { packDir, packName } of packs) {
    if (packDir !== undefined) {
      const qlpack = yaml.safeLoad(await fs.readFile(path.join(packDir, 'qlpack.yml'), 'utf8')) as { dbscheme: string };
      if (qlpack.dbscheme !== undefined && path.basename(qlpack.dbscheme) === path.basename(dbschemePath)) {
        return packName;
      }
    }
  }
  throw new Error(`Could not find qlpack file for dbscheme ${dbschemePath}`);
}

export async function getPrimaryDbscheme(datasetFolder: string): Promise<string> {
  const dbschemes = await glob(path.join(datasetFolder, '*.dbscheme'));

  if (dbschemes.length < 1) {
    throw new Error(`Can't find dbscheme for current database in ${datasetFolder}`);
  }

  dbschemes.sort();
  const dbscheme = dbschemes[0];

  if (dbschemes.length > 1) {
    Window.showErrorMessage(`Found multiple dbschemes in ${datasetFolder} during quick query; arbitrarily choosing the first, ${dbscheme}, to decide what library to use.`);
  }
  return dbscheme;
}

/**
 * A cached mapping from strings to value of type U.
 */
export class CachedOperation<U> {
  private readonly operation: (t: string, ...args: any[]) => Promise<U>;
  private readonly cached: Map<string, U>;
  private readonly lru: string[];
  private readonly inProgressCallbacks: Map<string, [(u: U) => void, (reason?: any) => void][]>;

  constructor(operation: (t: string, ...args: any[]) => Promise<U>, private cacheSize = 100) {
    this.operation = operation;
    this.lru = [];
    this.inProgressCallbacks = new Map<string, [(u: U) => void, (reason?: any) => void][]>();
    this.cached = new Map<string, U>();
  }

  async get(t: string, ...args: any[]): Promise<U> {
    // Try and retrieve from the cache
    const fromCache = this.cached.get(t);
    if (fromCache !== undefined) {
      // Move to end of lru list
      this.lru.push(this.lru.splice(this.lru.findIndex(v => v === t), 1)[0]);
      return fromCache;
    }
    // Otherwise check if in progress
    const inProgressCallback = this.inProgressCallbacks.get(t);
    if (inProgressCallback !== undefined) {
      // If so wait for it to resolve
      return await new Promise((resolve, reject) => {
        inProgressCallback.push([resolve, reject]);
      });
    }

    // Otherwise compute the new value, but leave a callback to allow sharing work
    const callbacks: [(u: U) => void, (reason?: any) => void][] = [];
    this.inProgressCallbacks.set(t, callbacks);
    try {
      const result = await this.operation(t, ...args);
      callbacks.forEach(f => f[0](result));
      this.inProgressCallbacks.delete(t);
      if (this.lru.length > this.cacheSize) {
        const toRemove = this.lru.shift()!;
        this.cached.delete(toRemove);
      }
      this.lru.push(t);
      this.cached.set(t, result);
      return result;
    } catch (e) {
      // Rethrow error on all callbacks
      callbacks.forEach(f => f[1](e));
      throw e;
    } finally {
      this.inProgressCallbacks.delete(t);
    }
  }
}



/**
 * The following functions al heuristically determine metadata about databases.
 */

/**
 * Note that this heuristic is only being used for backwards compatibility with
 * CLI versions before the langauge name was introduced to dbInfo. Features
 * that do not require backwards compatibility should call
 * `cli.CodeQLCliServer.resolveDatabase` and use the first entry in the
 * `languages` property.
 *
 * @see cli.CodeQLCliServer.supportsLanguageName
 * @see cli.CodeQLCliServer.resolveDatabase
 */
const dbSchemeToLanguage = {
  'semmlecode.javascript.dbscheme': 'javascript',
  'semmlecode.cpp.dbscheme': 'cpp',
  'semmlecode.dbscheme': 'java',
  'semmlecode.python.dbscheme': 'python',
  'semmlecode.csharp.dbscheme': 'csharp',
  'go.dbscheme': 'go'
};

/**
 * Returns the initial contents for an empty query, based on the language of the selected
 * databse.
 *
 * First try to use the given language name. If that doesn't exist, try to infer it based on
 * dbscheme. Otherwise return no import statement.
 *
 * @param language the database language or empty string if unknown
 * @param dbscheme path to the dbscheme file
 *
 * @returns an import and empty select statement appropriate for the selected language
 */
export function getInitialQueryContents(language: string, dbscheme: string) {
  if (!language) {
    const dbschemeBase = path.basename(dbscheme) as keyof typeof dbSchemeToLanguage;
    language = dbSchemeToLanguage[dbschemeBase];
  }

  return language
    ? `import ${language}\n\nselect ""`
    : 'select ""';
}

/**
 * Heuristically determines if the directory passed in corresponds
 * to a database root.
 *
 * @param maybeRoot
 */
export async function isLikelyDatabaseRoot(maybeRoot: string) {
  const [a, b, c] = (await Promise.all([
    // databases can have either .dbinfo or codeql-database.yml.
    fs.pathExists(path.join(maybeRoot, '.dbinfo')),
    fs.pathExists(path.join(maybeRoot, 'codeql-database.yml')),

    // they *must* have a db-{language} folder
    glob('db-*/', { cwd: maybeRoot })
  ]));

  return !!((a || b) && c);
}

export function isLikelyDbLanguageFolder(dbPath: string) {
  return !!path.basename(dbPath).startsWith('db-');
}
