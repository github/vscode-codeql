import Ajv from "ajv";

import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import {
  ExtensiblePredicateDefinition,
  extensiblePredicateDefinitions,
} from "./predicates";

import * as dataSchemaJson from "./data-schema.json";
import { sanitizeExtensionPackName } from "./extension-pack-name";

const ajv = new Ajv({ allErrors: true });
const dataSchemaValidate = ajv.compile(dataSchemaJson);

function createDataProperty(
  methods: ModeledMethod[],
  definition: ExtensiblePredicateDefinition,
) {
  if (methods.length === 0) {
    return " []";
  }

  return `\n${methods
    .map(
      (method) =>
        `      - ${JSON.stringify(
          definition.generateMethodDefinition(method),
        )}`,
    )
    .join("\n")}`;
}

export function createDataExtensionYaml(
  language: string,
  modeledMethods: ModeledMethod[],
) {
  const methodsByType: Record<
    Exclude<ModeledMethodType, "none">,
    ModeledMethod[]
  > = {
    source: [],
    sink: [],
    summary: [],
    neutral: [],
  };

  for (const modeledMethod of modeledMethods) {
    if (modeledMethod?.type && modeledMethod.type !== "none") {
      methodsByType[modeledMethod.type].push(modeledMethod);
    }
  }

  const extensions = Object.entries(extensiblePredicateDefinitions).map(
    ([type, definition]) => `  - addsTo:
      pack: codeql/${language}-all
      extensible: ${definition.extensiblePredicate}
    data:${createDataProperty(
      methodsByType[type as Exclude<ModeledMethodType, "none">],
      definition,
    )}
`,
  );

  return `extensions:
${extensions.join("\n")}`;
}

export function createDataExtensionYamlsForApplicationMode(
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
): Record<string, string> {
  const methodsByLibraryFilename: Record<string, ModeledMethod[]> = {};

  for (const externalApiUsage of externalApiUsages) {
    const modeledMethod = modeledMethods[externalApiUsage.signature];
    if (!modeledMethod) {
      continue;
    }

    const filename = createFilenameForLibrary(externalApiUsage.library);

    methodsByLibraryFilename[filename] =
      methodsByLibraryFilename[filename] || [];
    methodsByLibraryFilename[filename].push(modeledMethod);
  }

  const result: Record<string, string> = {};

  for (const [filename, methods] of Object.entries(methodsByLibraryFilename)) {
    result[filename] = createDataExtensionYaml(language, methods);
  }

  return result;
}

export function createDataExtensionYamlsForFrameworkMode(
  databaseName: string,
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
  prefix = "models/",
  suffix = ".model",
): Record<string, string> {
  const parts = databaseName.split("/");
  const libraryName = parts
    .slice(1)
    .map((part) => sanitizeExtensionPackName(part))
    .join("-");

  const methods = externalApiUsages
    .map((externalApiUsage) => modeledMethods[externalApiUsage.signature])
    .filter((modeledMethod) => modeledMethod !== undefined);

  return {
    [`${prefix}${libraryName}${suffix}.yml`]: createDataExtensionYaml(
      language,
      methods,
    ),
  };
}

export function createFilenameForLibrary(
  library: string,
  prefix = "models/",
  suffix = ".model",
) {
  let libraryName = library;

  // Lowercase everything
  libraryName = libraryName.toLowerCase();

  // Replace all spaces and underscores with hyphens
  libraryName = libraryName.replaceAll(/[\s_]+/g, "-");

  // Replace all characters which are not allowed by empty strings
  libraryName = libraryName.replaceAll(/[^a-z0-9.-]/g, "");

  // Remove any leading or trailing hyphens or dots
  libraryName = libraryName.replaceAll(/^[.-]+|[.-]+$/g, "");

  // Remove any duplicate hyphens
  libraryName = libraryName.replaceAll(/-{2,}/g, "-");
  // Remove any duplicate dots
  libraryName = libraryName.replaceAll(/\.{2,}/g, ".");

  return `${prefix}${libraryName}${suffix}.yml`;
}

export function loadDataExtensionYaml(
  data: any,
): Record<string, ModeledMethod> | undefined {
  dataSchemaValidate(data);

  if (dataSchemaValidate.errors) {
    throw new Error(
      `Invalid data extension YAML: ${dataSchemaValidate.errors
        .map((error) => `${error.instancePath} ${error.message}`)
        .join(", ")}`,
    );
  }

  const extensions = data.extensions;
  if (!Array.isArray(extensions)) {
    return undefined;
  }

  const modeledMethods: Record<string, ModeledMethod> = {};

  for (const extension of extensions) {
    const addsTo = extension.addsTo;
    const extensible = addsTo.extensible;
    const data = extension.data;

    const definition = Object.values(extensiblePredicateDefinitions).find(
      (definition) => definition.extensiblePredicate === extensible,
    );
    if (!definition) {
      continue;
    }

    for (const row of data) {
      const modeledMethod = definition.readModeledMethod(row);
      if (!modeledMethod) {
        continue;
      }
      modeledMethods[modeledMethod.signature] = modeledMethod;
    }
  }

  return modeledMethods;
}
