import {
  ensureDirSync,
  readFile,
  pathExists,
  ensureDir,
  writeFile,
  opendir,
} from "fs-extra";
import { promise as glob } from "glob-promise";
import { load } from "js-yaml";
import { join, basename } from "path";
import { dirSync } from "tmp-promise";
import {
  ExtensionContext,
  Uri,
  window as Window,
  workspace,
  env,
} from "vscode";
import { CodeQLCliServer, QlpacksInfo } from "./cli";
import { UserCancellationException } from "./commandRunner";
import { extLogger, OutputChannelLogger } from "./common";
import { QueryMetadata } from "./pure/interface-types";

// Shared temporary folder for the extension.
export const tmpDir = dirSync({
  prefix: "queries_",
  keep: false,
  unsafeCleanup: true,
});
export const upgradesTmpDir = join(tmpDir.name, "upgrades");
ensureDirSync(upgradesTmpDir);

export const tmpDirDisposal = {
  dispose: () => {
    try {
      tmpDir.removeCallback();
    } catch (e) {
      void extLogger.log(
        `Failed to remove temporary directory ${tmpDir.name}: ${e}`,
      );
    }
  },
};

interface ShowAndLogOptions {
  outputLogger?: OutputChannelLogger;
  items?: string[];
  fullMessage?: string;
}

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
export async function showAndLogErrorMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(
    dropLinesExceptInitial(message),
    Window.showErrorMessage,
    options,
  );
}

function dropLinesExceptInitial(message: string, n = 2) {
  return message.toString().split(/\r?\n/).slice(0, n).join("\n");
}

/**
 * Show a warning message and log it to the console
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
export async function showAndLogWarningMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(message, Window.showWarningMessage, options);
}

/**
 * Show an information message and log it to the console
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
export async function showAndLogInformationMessage(
  message: string,
  options?: ShowAndLogOptions,
): Promise<string | undefined> {
  return internalShowAndLog(message, Window.showInformationMessage, options);
}

type ShowMessageFn = (
  message: string,
  ...items: string[]
) => Thenable<string | undefined>;

async function internalShowAndLog(
  message: string,
  fn: ShowMessageFn,
  { items = [], outputLogger = extLogger, fullMessage }: ShowAndLogOptions = {},
): Promise<string | undefined> {
  const label = "Show Log";
  void outputLogger.log(fullMessage || message);
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
 * @param yesTitle The text in the box indicating the affirmative choice.
 * @param noTitle The text in the box indicating the negative choice.
 *
 * @return
 *  `true` if the user clicks 'Yes',
 *  `false` if the user clicks 'No' or cancels the dialog,
 *  `undefined` if the dialog is closed without the user making a choice.
 */
export async function showBinaryChoiceDialog(
  message: string,
  modal = true,
  yesTitle = "Yes",
  noTitle = "No",
): Promise<boolean | undefined> {
  const yesItem = { title: yesTitle, isCloseAffordance: false };
  const noItem = { title: noTitle, isCloseAffordance: true };
  const chosenItem = await Window.showInformationMessage(
    message,
    { modal },
    yesItem,
    noItem,
  );
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
export async function showBinaryChoiceWithUrlDialog(
  message: string,
  url: string,
): Promise<boolean | undefined> {
  const urlItem = { title: "More Information", isCloseAffordance: false };
  const yesItem = { title: "Yes", isCloseAffordance: false };
  const noItem = { title: "No", isCloseAffordance: true };
  let chosenItem;

  // Keep the dialog open as long as the user is clicking the 'more information' option.
  // To prevent an infinite loop, if the user clicks 'more information' 5 times, close the dialog and return cancelled
  let count = 0;
  do {
    chosenItem = await Window.showInformationMessage(
      message,
      { modal: true },
      urlItem,
      yesItem,
      noItem,
    );
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
export async function showInformationMessageWithAction(
  message: string,
  actionMessage: string,
): Promise<boolean> {
  const actionItem = { title: actionMessage, isCloseAffordance: false };
  const chosenItem = await Window.showInformationMessage(message, actionItem);
  return chosenItem === actionItem;
}

/** Gets all active workspace folders that are on the filesystem. */
export function getOnDiskWorkspaceFolders() {
  const workspaceFolders = workspace.workspaceFolders || [];
  const diskWorkspaceFolders: string[] = [];
  for (const workspaceFolder of workspaceFolders) {
    if (workspaceFolder.uri.scheme === "file")
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
    createDate: (dateString?: string) => Date = (s) =>
      s ? new Date(s) : new Date(),
  ) {
    this._createDate = createDate;
    this._extensionContext = extensionContext;
    this._func = func;
    this._funcIdentifier = funcIdentifier;
  }

  /**
   * Invoke the function if `minSecondsSinceLastInvocation` seconds have elapsed since the last invocation.
   */
  public async invokeFunctionIfIntervalElapsed(
    minSecondsSinceLastInvocation: number,
  ): Promise<InvocationRateLimiterResult<T>> {
    const updateCheckStartDate = this._createDate();
    const lastInvocationDate = this.getLastInvocationDate();
    if (
      minSecondsSinceLastInvocation &&
      lastInvocationDate &&
      lastInvocationDate <= updateCheckStartDate &&
      lastInvocationDate.getTime() + minSecondsSinceLastInvocation * 1000 >
        updateCheckStartDate.getTime()
    ) {
      return createRateLimitedResult();
    }
    const result = await this._func();
    await this.setLastInvocationDate(updateCheckStartDate);
    return createInvokedResult(result);
  }

  private getLastInvocationDate(): Date | undefined {
    const maybeDateString: string | undefined =
      this._extensionContext.globalState.get(
        InvocationRateLimiter._invocationRateLimiterPrefix +
          this._funcIdentifier,
      );
    return maybeDateString ? this._createDate(maybeDateString) : undefined;
  }

  private async setLastInvocationDate(date: Date): Promise<void> {
    return await this._extensionContext.globalState.update(
      InvocationRateLimiter._invocationRateLimiterPrefix + this._funcIdentifier,
      date,
    );
  }

  private readonly _createDate: (dateString?: string) => Date;
  private readonly _extensionContext: ExtensionContext;
  private readonly _func: () => Promise<T>;
  private readonly _funcIdentifier: string;

  private static readonly _invocationRateLimiterPrefix =
    "invocationRateLimiter_lastInvocationDate_";
}

export enum InvocationRateLimiterResultKind {
  Invoked,
  RateLimited,
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
    result,
  };
}

function createRateLimitedResult(): RateLimitedResult {
  return {
    kind: InvocationRateLimiterResultKind.RateLimited,
  };
}

export interface QlPacksForLanguage {
  /** The name of the pack containing the dbscheme. */
  dbschemePack: string;
  /** `true` if `dbschemePack` is a library pack. */
  dbschemePackIsLibraryPack: boolean;
  /**
   * The name of the corresponding standard query pack.
   * Only defined if `dbschemePack` is a library pack.
   */
  queryPack?: string;
}

interface QlPackWithPath {
  packName: string;
  packDir: string | undefined;
}

async function findDbschemePack(
  packs: QlPackWithPath[],
  dbschemePath: string,
): Promise<{ name: string; isLibraryPack: boolean }> {
  for (const { packDir, packName } of packs) {
    if (packDir !== undefined) {
      const qlpack = load(
        await readFile(join(packDir, "qlpack.yml"), "utf8"),
      ) as { dbscheme?: string; library?: boolean };
      if (
        qlpack.dbscheme !== undefined &&
        basename(qlpack.dbscheme) === basename(dbschemePath)
      ) {
        return {
          name: packName,
          isLibraryPack: qlpack.library === true,
        };
      }
    }
  }
  throw new Error(`Could not find qlpack file for dbscheme ${dbschemePath}`);
}

function findStandardQueryPack(
  qlpacks: QlpacksInfo,
  dbschemePackName: string,
): string | undefined {
  const matches = dbschemePackName.match(/^codeql\/(?<language>[a-z]+)-all$/);
  if (matches) {
    const queryPackName = `codeql/${matches.groups!.language}-queries`;
    if (qlpacks[queryPackName] !== undefined) {
      return queryPackName;
    }
  }

  // Either the dbscheme pack didn't look like one where the queries might be in the query pack, or
  // no query pack was found in the search path. Either is OK.
  return undefined;
}

export async function getQlPackForDbscheme(
  cliServer: CodeQLCliServer,
  dbschemePath: string,
): Promise<QlPacksForLanguage> {
  const qlpacks = await cliServer.resolveQlpacks(getOnDiskWorkspaceFolders());
  const packs: QlPackWithPath[] = Object.entries(qlpacks).map(
    ([packName, dirs]) => {
      if (dirs.length < 1) {
        void extLogger.log(
          `In getQlPackFor ${dbschemePath}, qlpack ${packName} has no directories`,
        );
        return { packName, packDir: undefined };
      }
      if (dirs.length > 1) {
        void extLogger.log(
          `In getQlPackFor ${dbschemePath}, qlpack ${packName} has more than one directory; arbitrarily choosing the first`,
        );
      }
      return {
        packName,
        packDir: dirs[0],
      };
    },
  );
  const dbschemePack = await findDbschemePack(packs, dbschemePath);
  const queryPack = dbschemePack.isLibraryPack
    ? findStandardQueryPack(qlpacks, dbschemePack.name)
    : undefined;
  return {
    dbschemePack: dbschemePack.name,
    dbschemePackIsLibraryPack: dbschemePack.isLibraryPack,
    queryPack,
  };
}

export async function getPrimaryDbscheme(
  datasetFolder: string,
): Promise<string> {
  const dbschemes = await glob(join(datasetFolder, "*.dbscheme"));

  if (dbschemes.length < 1) {
    throw new Error(
      `Can't find dbscheme for current database in ${datasetFolder}`,
    );
  }

  dbschemes.sort();
  const dbscheme = dbschemes[0];

  if (dbschemes.length > 1) {
    void Window.showErrorMessage(
      `Found multiple dbschemes in ${datasetFolder} during quick query; arbitrarily choosing the first, ${dbscheme}, to decide what library to use.`,
    );
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
  private readonly inProgressCallbacks: Map<
    string,
    Array<[(u: U) => void, (reason?: any) => void]>
  >;

  constructor(
    operation: (t: string, ...args: any[]) => Promise<U>,
    private cacheSize = 100,
  ) {
    this.operation = operation;
    this.lru = [];
    this.inProgressCallbacks = new Map<
      string,
      Array<[(u: U) => void, (reason?: any) => void]>
    >();
    this.cached = new Map<string, U>();
  }

  async get(t: string, ...args: any[]): Promise<U> {
    // Try and retrieve from the cache
    const fromCache = this.cached.get(t);
    if (fromCache !== undefined) {
      // Move to end of lru list
      this.lru.push(
        this.lru.splice(
          this.lru.findIndex((v) => v === t),
          1,
        )[0],
      );
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
    const callbacks: Array<[(u: U) => void, (reason?: any) => void]> = [];
    this.inProgressCallbacks.set(t, callbacks);
    try {
      const result = await this.operation(t, ...args);
      callbacks.forEach((f) => f[0](result));
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
      callbacks.forEach((f) => f[1](e));
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
 * @see cli.CodeQLCliServer.resolveDatabase
 */
export const dbSchemeToLanguage = {
  "semmlecode.javascript.dbscheme": "javascript",
  "semmlecode.cpp.dbscheme": "cpp",
  "semmlecode.dbscheme": "java",
  "semmlecode.python.dbscheme": "python",
  "semmlecode.csharp.dbscheme": "csharp",
  "go.dbscheme": "go",
  "ruby.dbscheme": "ruby",
  "swift.dbscheme": "swift",
};

export const languageToDbScheme = Object.entries(dbSchemeToLanguage).reduce(
  (acc, [k, v]) => {
    acc[v] = k;
    return acc;
  },
  {} as { [k: string]: string },
);

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
    const dbschemeBase = basename(dbscheme) as keyof typeof dbSchemeToLanguage;
    language = dbSchemeToLanguage[dbschemeBase];
  }

  return language ? `import ${language}\n\nselect ""` : 'select ""';
}

/**
 * Heuristically determines if the directory passed in corresponds
 * to a database root. A database root is a directory that contains
 * a codeql-database.yml or (historically) a .dbinfo file. It also
 * contains a folder starting with `db-`.
 */
export async function isLikelyDatabaseRoot(maybeRoot: string) {
  const [a, b, c] = await Promise.all([
    // databases can have either .dbinfo or codeql-database.yml.
    pathExists(join(maybeRoot, ".dbinfo")),
    pathExists(join(maybeRoot, "codeql-database.yml")),

    // they *must* have a db-{language} folder
    glob("db-*/", { cwd: maybeRoot }),
  ]);

  return (a || b) && c.length > 0;
}

/**
 * A language folder is any folder starting with `db-` that is itself not a database root.
 */
export async function isLikelyDbLanguageFolder(dbPath: string) {
  return (
    basename(dbPath).startsWith("db-") && !(await isLikelyDatabaseRoot(dbPath))
  );
}

/**
 * Finds the language that a query targets.
 * If it can't be autodetected, prompt the user to specify the language manually.
 */
export async function findLanguage(
  cliServer: CodeQLCliServer,
  queryUri: Uri | undefined,
): Promise<string | undefined> {
  const uri = queryUri || Window.activeTextEditor?.document.uri;
  if (uri !== undefined) {
    try {
      const queryInfo = await cliServer.resolveQueryByLanguage(
        getOnDiskWorkspaceFolders(),
        uri,
      );
      const language = Object.keys(queryInfo.byLanguage)[0];
      void extLogger.log(`Detected query language: ${language}`);
      return language;
    } catch (e) {
      void extLogger.log(
        "Could not autodetect query language. Select language manually.",
      );
    }
  }

  // will be undefined if user cancels the quick pick.
  return await askForLanguage(cliServer, false);
}

export async function askForLanguage(
  cliServer: CodeQLCliServer,
  throwOnEmpty = true,
): Promise<string | undefined> {
  const language = await Window.showQuickPick(
    await cliServer.getSupportedLanguages(),
    {
      placeHolder: "Select target language for your query",
      ignoreFocusOut: true,
    },
  );
  if (!language) {
    // This only happens if the user cancels the quick pick.
    if (throwOnEmpty) {
      throw new UserCancellationException("Cancelled.");
    } else {
      void showAndLogErrorMessage(
        "Language not found. Language must be specified manually.",
      );
    }
  }
  return language;
}

/**
 * Gets metadata for a query, if it exists.
 * @param cliServer The CLI server.
 * @param queryPath The path to the query.
 * @returns A promise that resolves to the query metadata, if available.
 */
export async function tryGetQueryMetadata(
  cliServer: CodeQLCliServer,
  queryPath: string,
): Promise<QueryMetadata | undefined> {
  try {
    return await cliServer.resolveMetadata(queryPath);
  } catch (e) {
    // Ignore errors and provide no metadata.
    void extLogger.log(`Couldn't resolve metadata for ${queryPath}: ${e}`);
    return;
  }
}

/**
 * Creates a file in the query directory that indicates when this query was created.
 * This is important for keeping track of when queries should be removed.
 *
 * @param queryPath The directory that will containt all files relevant to a query result.
 * It does not need to exist.
 */
export async function createTimestampFile(storagePath: string) {
  const timestampPath = join(storagePath, "timestamp");
  await ensureDir(storagePath);
  await writeFile(timestampPath, Date.now().toString(), "utf8");
}

/**
 * Recursively walk a directory and return the full path to all files found.
 * Symbolic links are ignored.
 *
 * @param dir the directory to walk
 *
 * @return An iterator of the full path to all files recursively found in the directory.
 */
export async function* walkDirectory(
  dir: string,
): AsyncIterableIterator<string> {
  const seenFiles = new Set<string>();
  for await (const d of await opendir(dir)) {
    const entry = join(dir, d.name);
    seenFiles.add(entry);
    if (d.isDirectory()) {
      yield* walkDirectory(entry);
    } else if (d.isFile()) {
      yield entry;
    }
  }
}
