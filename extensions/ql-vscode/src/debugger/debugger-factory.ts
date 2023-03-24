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
  ) {
    super();
    this.push(debug.registerDebugAdapterDescriptorFactory("codeql", this));
    this.push(
      debug.registerDebugConfigurationProvider(
        "codeql",
        new QLDebugConfigurationProvider(),
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
