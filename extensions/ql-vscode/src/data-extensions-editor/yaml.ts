import Ajv from "ajv";

import { basename, extname } from "../common/path";
import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import {
  ExtensiblePredicateDefinition,
  extensiblePredicateDefinitions,
  ExternalApiUsageByType,
} from "./predicates";

import * as dataSchemaJson from "./data-schema.json";
import { sanitizeExtensionPackName } from "./extension-pack-name";
import { Mode } from "./shared/mode";
import { assertNever } from "../common/helpers-pure";

const ajv = new Ajv({ allErrors: true });
const dataSchemaValidate = ajv.compile(dataSchemaJson);

type ModeledExternalApiUsage = {
  externalApiUsage: ExternalApiUsage;
  modeledMethod?: ModeledMethod;
};

function createDataProperty(
  methods: ModeledExternalApiUsage[],
  definition: ExtensiblePredicateDefinition,
) {
  if (methods.length === 0) {
    return " []";
  }

  const modeledMethods = methods.filter(
    (method): method is ExternalApiUsageByType =>
      method.modeledMethod !== undefined,
  );

  return `\n${modeledMethods
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
  modeledUsages: ModeledExternalApiUsage[],
) {
  const methodsByType: Record<
    Exclude<ModeledMethodType, "none">,
    ModeledExternalApiUsage[]
  > = {
    source: [],
    sink: [],
    summary: [],
    neutral: [],
  };

  for (const modeledUsage of modeledUsages) {
    const { modeledMethod } = modeledUsage;

    if (modeledMethod?.type && modeledMethod.type !== "none") {
      methodsByType[modeledMethod.type].push(modeledUsage);
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

export function createDataExtensionYamls(
  databaseName: string,
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
  mode: Mode,
) {
  switch (mode) {
    case Mode.Application:
      return createDataExtensionYamlsForApplicationMode(
        language,
        externalApiUsages,
        modeledMethods,
      );
    case Mode.Framework:
      return createDataExtensionYamlsForFrameworkMode(
        databaseName,
        language,
        externalApiUsages,
        modeledMethods,
      );
    default:
      assertNever(mode);
  }
}

export function createDataExtensionYamlsForApplicationMode(
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
): Record<string, string> {
  const methodsByLibraryFilename: Record<string, ModeledExternalApiUsage[]> =
    {};

  for (const externalApiUsage of externalApiUsages) {
    const modeledMethod = modeledMethods[externalApiUsage.signature];

    const filename = createFilenameForLibrary(externalApiUsage.library);

    methodsByLibraryFilename[filename] =
      methodsByLibraryFilename[filename] || [];
    methodsByLibraryFilename[filename].push({
      externalApiUsage,
      modeledMethod,
    });
  }

  const result: Record<string, string> = {};

  for (const [filename, methods] of Object.entries(methodsByLibraryFilename)) {
    const hasModeledMethods = methods.some(
      (method) => method.modeledMethod !== undefined,
    );
    if (!hasModeledMethods) {
      continue;
    }

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

  const methods = externalApiUsages.map((externalApiUsage) => ({
    externalApiUsage,
    modeledMethod: modeledMethods[externalApiUsage.signature],
  }));

  return {
    [`${prefix}${libraryName}${suffix}.yml`]: createDataExtensionYaml(
      language,
      methods,
    ),
  };
}

// From the semver package using
// const { re, t } = require("semver/internal/re");
// console.log(re[t.LOOSE]);
// Modified to remove the ^ and $ anchors
// This will match any semver string at the end of a larger string
const semverRegex =
  /[v=\s]*([0-9]+)\.([0-9]+)\.([0-9]+)(?:-?((?:[0-9]+|\d*[a-zA-Z-][a-zA-Z0-9-]*)(?:\.(?:[0-9]+|\d*[a-zA-Z-][a-zA-Z0-9-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?/;

export function createFilenameForLibrary(
  library: string,
  prefix = "models/",
  suffix = ".model",
) {
  let libraryName = basename(library);
  const extension = extname(libraryName);
  libraryName = libraryName.slice(0, -extension.length);

  const match = semverRegex.exec(libraryName);

  if (match !== null) {
    // Remove everything after the start of the match
    libraryName = libraryName.slice(0, match.index);
  }

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
      const result = definition.readModeledMethod(row);
      if (!result) {
        continue;
      }

      const { signature, modeledMethod } = result;

      modeledMethods[signature] = modeledMethod;
    }
  }

  return modeledMethods;
}
