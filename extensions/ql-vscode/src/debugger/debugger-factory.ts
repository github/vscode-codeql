import type {
  DebugAdapterDescriptor,
  DebugAdapterDescriptorFactory,
  DebugAdapterExecutable,
  DebugSession,
  ProviderResult,
} from "vscode";
import {
  debug,
  DebugAdapterInlineImplementation,
  DebugConfigurationProviderTriggerKind,
} from "vscode";
import { isCanary } from "../config";
import type { LocalQueries } from "../local-queries";
import { DisposableObject } from "../common/disposable-object";
import type { QueryRunner } from "../query-server";
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
