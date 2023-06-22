import { Event } from "vscode";
import { ExternalApiUsage } from "../external-api-usage";

export interface ExternalApiUsageProvider {
  readonly externalApiUsages: ReadonlyArray<Readonly<ExternalApiUsage>>;
  readonly onDidChangeExternalApiUsages: Event<void>;
}
