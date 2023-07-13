import { outputFile } from "fs-extra";
import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod } from "./modeled-method";
import { Mode } from "./shared/mode";
import { createDataExtensionYamls } from "./yaml";
import { join } from "path";
import { ExtensionPack } from "./shared/extension-pack";
import { Logger } from "../common/logging";

export async function saveModeledMethods(
  extensionPack: ExtensionPack,
  databaseName: string,
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
  mode: Mode,
  logger: Logger,
): Promise<void> {
  const yamls = createDataExtensionYamls(
    databaseName,
    language,
    externalApiUsages,
    modeledMethods,
    mode,
  );

  for (const [filename, yaml] of Object.entries(yamls)) {
    await outputFile(join(extensionPack.path, filename), yaml);
  }

  void logger.log(`Saved data extension YAML`);
}
