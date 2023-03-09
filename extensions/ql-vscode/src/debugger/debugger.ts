import {
  CancellationToken,
  debug,
  DebugAdapterDescriptor,
  DebugAdapterDescriptorFactory,
  DebugAdapterExecutable,
  DebugAdapterInlineImplementation,
  DebugAdapterServer,
  DebugConfiguration,
  DebugConfigurationProvider,
  DebugConfigurationProviderTriggerKind,
  DebugSession,
  Disposable,
  ProviderResult,
  Uri,
  WorkspaceFolder,
} from "vscode";
import {
  ExitedEvent,
  InitializedEvent,
  LoggingDebugSession,
  OutputEvent,
  TerminatedEvent,
} from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { DisposableObject } from "../pure/disposable-object";
import { CancellationTokenSource } from "vscode-jsonrpc";
import { DatabaseDetails, QueryRunner, validateDatabase } from "../queryRunner";
import { DatabaseManager } from "../local-databases";
import { createInitialQueryInfo } from "../run-queries-shared";
import { InitialQueryInfo, LocalQueryInfo } from "../query-results";

interface QLLaunchOptionsBase {
  query: string;
}

interface QLLaunchOptions extends QLLaunchOptionsBase {
  database: string;
}

interface ResolvedQLLaunchOptions extends QLLaunchOptionsBase {
  database: DatabaseDetails;
}

type QLDebugConfiguration = DebugConfiguration & Partial<QLLaunchOptions>;

type QLResolvedDebugConfiguration = DebugConfiguration &
  ResolvedQLLaunchOptions;

type CodeQLLaunchRequestArguments = DebugProtocol.LaunchRequestArguments &
  ResolvedQLLaunchOptions;

class QLDebugSession extends LoggingDebugSession implements Disposable {
  private database: DatabaseDetails | undefined = undefined;
  private queryInfo: InitialQueryInfo | undefined = undefined;
  private tokenSource: CancellationTokenSource | undefined = undefined;

  constructor(
    private readonly queryStorageDir: string,
    private readonly queryRunner: QueryRunner,
  ) {
    super();
  }

  public dispose(): void {
    this.cancelEvaluation();
  }

  protected dispatchRequest(request: DebugProtocol.Request): void {
    super.dispatchRequest(request);
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    _args: DebugProtocol.InitializeRequestArguments,
  ): void {
    response.body = response.body ?? {};
    response.body.supportsStepBack = false;
    response.body.supportsStepInTargetsRequest = false;
    response.body.supportsRestartFrame = false;
    response.body.supportsGotoTargetsRequest = false;

    this.sendResponse(response);

    this.sendEvent(new InitializedEvent());
  }

  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments,
    request?: DebugProtocol.Request,
  ): void {
    super.configurationDoneRequest(response, args, request);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    _args: DebugProtocol.DisconnectArguments,
    _request?: DebugProtocol.Request,
  ): void {
    response.body = response.body ?? {};
    // Neither of the args (`terminateDebuggee` and `restart`) matter for CodeQL.

    this.sendResponse(response);
  }

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: CodeQLLaunchRequestArguments,
    _request?: DebugProtocol.Request,
  ): void {
    void this.launch(response, args); //TODO: Cancelation?
  }

  protected threadsRequest(
    response: DebugProtocol.ThreadsResponse,
    request?: DebugProtocol.Request,
  ): void {
    response.body = response.body ?? {};
    response.body.threads = [
      {
        id: 1,
        name: "Evaluation thread",
      },
    ];

    super.threadsRequest(response, request);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    _args: DebugProtocol.StackTraceArguments,
    _request?: DebugProtocol.Request,
  ): void {
    response.body = response.body ?? {};
    response.body.stackFrames = [];

    super.stackTraceRequest(response, _args, _request);
  }

  private async launch(
    response: DebugProtocol.LaunchResponse,
    args: CodeQLLaunchRequestArguments,
  ): Promise<void> {
    response.body = response.body ?? {};

    this.database = args.database;

    const databaseInfo = {
      name: this.database.name,
      databaseUri: Uri.file(this.database.path).toString(),
    };
    this.queryInfo = await createInitialQueryInfo(
      Uri.file(args.query),
      databaseInfo,
      false,
      undefined,
    );

    void this.evaluate(response);
  }

  private async evaluate(
    response: DebugProtocol.LaunchResponse,
  ): Promise<void> {
    this.tokenSource = new CancellationTokenSource();
    // handle cancellation from the history view.
    const localQueryInfo = new LocalQueryInfo(
      this.queryInfo!,
      this.tokenSource!,
    );
    // TODO: Add to history manager
    const evaluation = this.queryRunner.compileAndRunQueryAgainstDatabase(
      this.database!,
      this.queryInfo!,
      this.queryStorageDir,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      (_p) => {},
      this.tokenSource!.token,
      undefined,
      localQueryInfo,
    );

    // TODO: Handle exception from `compileAndRunQuery()`.
    // Send the response immediately after we start evaluating.
    this.sendResponse(response);

    try {
      await evaluation;
      this.reportTerminated(0);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      const outputEvent = new OutputEvent(message, "important");
      this.sendEvent(outputEvent);
      this.reportTerminated(1);
    } finally {
      this.disposeTokenSource();
    }
  }

  private reportTerminated(exitCode: number): void {
    const terminatedEvent = new TerminatedEvent();
    this.sendEvent(terminatedEvent);

    const exitedEvent = new ExitedEvent(exitCode);
    this.sendEvent(exitedEvent);
  }

  private disposeTokenSource(): void {
    this.tokenSource!.dispose();
    this.tokenSource = undefined;
  }

  private cancelEvaluation(): void {
    if (this.tokenSource !== undefined) {
      this.tokenSource.cancel();
      this.disposeTokenSource();
    }
  }
}

class QLDebugConfigurationProvider implements DebugConfigurationProvider {
  public constructor(private readonly databaseManager: DatabaseManager) {}

  public async resolveDebugConfigurationWithSubstitutedVariables(
    _folder: WorkspaceFolder | undefined,
    debugConfiguration: DebugConfiguration,
    _token?: CancellationToken,
  ): Promise<DebugConfiguration | null> {
    const qlConfiguration = <QLDebugConfiguration>debugConfiguration;

    if (qlConfiguration.query === undefined) {
      // TODO: Error
      return null;
    }
    if (qlConfiguration.database === undefined) {
      // TODO: Error
      return null;
    }

    const dbItem = await this.databaseManager.createOrOpenDatabaseItem(
      Uri.file(qlConfiguration.database),
    );
    const resultConfiguration: QLResolvedDebugConfiguration = {
      ...qlConfiguration,
      query: qlConfiguration.query,
      database: await validateDatabase(dbItem),
    };

    return resultConfiguration;
  }
}

const useInlineImplementation = true;

export class QLDebugAdapterDescriptorFactory
  extends DisposableObject
  implements DebugAdapterDescriptorFactory
{
  constructor(
    private readonly queryStorageDir: string,
    private readonly queryRunner: QueryRunner,
    private readonly databaseManager: DatabaseManager,
  ) {
    super();
    this.push(debug.registerDebugAdapterDescriptorFactory("codeql", this));
    this.push(
      debug.registerDebugConfigurationProvider(
        "codeql",
        new QLDebugConfigurationProvider(this.databaseManager),
        DebugConfigurationProviderTriggerKind.Dynamic,
      ),
    );

    this.push(debug.onDidStartDebugSession(this.handleOnDidStartDebugSession));
  }

  public createDebugAdapterDescriptor(
    _session: DebugSession,
    _executable: DebugAdapterExecutable | undefined,
  ): ProviderResult<DebugAdapterDescriptor> {
    if (useInlineImplementation) {
      return new DebugAdapterInlineImplementation(
        new QLDebugSession(this.queryStorageDir, this.queryRunner),
      );
    } else {
      return new DebugAdapterServer(2112);
    }
  }

  private handleOnDidStartDebugSession(session: DebugSession): void {
    const config = session.configuration;
    void config;
  }
}
