import {
  debug,
  DebugAdapterDescriptor,
  DebugAdapterDescriptorFactory,
  DebugAdapterExecutable,
  DebugAdapterInlineImplementation,
  DebugConfigurationProviderTriggerKind,
  DebugSession,
  ProviderResult,
} from "vscode";
import { isCanary } from "../config";
import { LocalQueries } from "../local-queries/local-queries";
import { DisposableObject } from "../pure/disposable-object";
import { QueryRunner } from "../queryRunner";
import { QLDebugConfigurationProvider } from "./debug-configuration";
import { QLDebugSession } from "./debug-session";

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
  }

  public createDebugAdapterDescriptor(
    _session: DebugSession,
    _executable: DebugAdapterExecutable | undefined,
  ): ProviderResult<DebugAdapterDescriptor> {
    if (!isCanary()) {
      throw new Error("The CodeQL debugger feature is not available yet.");
    }
    return new DebugAdapterInlineImplementation(
      new QLDebugSession(this.queryStorageDir, this.queryRunner),
    );
  }
}
