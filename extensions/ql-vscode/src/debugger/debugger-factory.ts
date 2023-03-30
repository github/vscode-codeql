import {
  debug,
  DebugAdapterDescriptor,
  DebugAdapterDescriptorFactory,
  DebugAdapterExecutable,
  DebugAdapterInlineImplementation,
  DebugAdapterServer,
  DebugConfigurationProviderTriggerKind,
  DebugSession,
  ProviderResult,
} from "vscode";
import { LocalQueries } from "../local-queries";
import { DisposableObject } from "../pure/disposable-object";
import { QueryRunner } from "../queryRunner";
import { QLDebugConfigurationProvider } from "./debug-configuration";
import { QLDebugSession } from "./debug-session";

const useInlineImplementation = true;

export class QLDebugAdapterDescriptorFactory
  extends DisposableObject
  implements DebugAdapterDescriptorFactory
{
  constructor(
    private readonly queryStorageDir: string,
    private readonly queryRunner: QueryRunner,
    localQueries: LocalQueries,
  ) {
    super();
    this.push(debug.registerDebugAdapterDescriptorFactory("codeql", this));
    this.push(
      debug.registerDebugConfigurationProvider(
        "codeql",
        new QLDebugConfigurationProvider(localQueries),
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
