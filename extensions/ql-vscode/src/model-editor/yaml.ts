import Ajv from "ajv";

import { Method } from "./method";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import {
  ExtensiblePredicateDefinition,
  extensiblePredicateDefinitions,
} from "./predicates";

import * as modelExtensionFileSchema from "./model-extension-file.schema.json";
import { Mode } from "./shared/mode";
import { assertNever } from "../common/helpers-pure";
import { ModelExtensionFile } from "./model-extension-file";

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const modelExtensionFileSchemaValidate = ajv.compile(modelExtensionFileSchema);

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

export function createDataExtensionYamls(
  language: string,
  methods: Method[],
  newModeledMethods: Record<string, ModeledMethod[]>,
  existingModeledMethods: Record<string, Record<string, ModeledMethod[]>>,
  mode: Mode,
) {
  switch (mode) {
    case Mode.Application:
      return createDataExtensionYamlsForApplicationMode(
        language,
        methods,
        newModeledMethods,
        existingModeledMethods,
      );
    case Mode.Framework:
      return createDataExtensionYamlsForFrameworkMode(
        language,
        methods,
        newModeledMethods,
        existingModeledMethods,
      );
    default:
      assertNever(mode);
  }
}

function createDataExtensionYamlsByGrouping(
  language: string,
  methods: Method[],
  newModeledMethods: Record<string, ModeledMethod[]>,
  existingModeledMethods: Record<string, Record<string, ModeledMethod[]>>,
  createFilename: (method: Method) => string,
): Record<string, string> {
  const methodsByFilename: Record<string, Record<string, ModeledMethod[]>> = {};

  // We only want to generate a yaml file when it's a known external API usage
  // and there are new modeled methods for it. This avoids us overwriting other
  // files that may contain data we don't know about.
  for (const method of methods) {
    if (method.signature in newModeledMethods) {
      methodsByFilename[createFilename(method)] = {};
    }
  }

  // First populate methodsByFilename with any existing modeled methods.
  for (const [filename, methodsBySignature] of Object.entries(
    existingModeledMethods,
  )) {
    if (filename in methodsByFilename) {
      for (const [signature, methods] of Object.entries(methodsBySignature)) {
        methodsByFilename[filename][signature] = methods;
      }
    }
  }

  // Add the new modeled methods, potentially overwriting existing modeled methods
  // but not removing existing modeled methods that are not in the new set.
  for (const method of methods) {
    const newMethods = newModeledMethods[method.signature];
    if (newMethods) {
      const filename = createFilename(method);

      // Override any existing modeled methods with the new ones.
      methodsByFilename[filename][method.signature] = newMethods;
    }
  }

  const result: Record<string, string> = {};

  for (const [filename, methods] of Object.entries(methodsByFilename)) {
    result[filename] = createDataExtensionYaml(
      language,
      Object.values(methods).flatMap((methods) => methods),
    );
  }

  return result;
}

export function createDataExtensionYamlsForApplicationMode(
  language: string,
  methods: Method[],
  newModeledMethods: Record<string, ModeledMethod[]>,
  existingModeledMethods: Record<string, Record<string, ModeledMethod[]>>,
): Record<string, string> {
  return createDataExtensionYamlsByGrouping(
    language,
    methods,
    newModeledMethods,
    existingModeledMethods,
    (method) => createFilenameForLibrary(method.library),
  );
}

export function createDataExtensionYamlsForFrameworkMode(
  language: string,
  methods: Method[],
  newModeledMethods: Record<string, ModeledMethod[]>,
  existingModeledMethods: Record<string, Record<string, ModeledMethod[]>>,
): Record<string, string> {
  return createDataExtensionYamlsByGrouping(
    language,
    methods,
    newModeledMethods,
    existingModeledMethods,
    (method) => createFilenameForPackage(method.packageName),
  );
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

export function createFilenameForPackage(
  packageName: string,
  prefix = "models/",
  suffix = ".model",
) {
  // A package name is e.g. `com.google.common.io` or `System.Net.Http.Headers`
  // We want to place these into `models/com.google.common.io.model.yml` and
  // `models/System.Net.Http.Headers.model.yml` respectively.
  return `${prefix}${packageName}${suffix}.yml`;
}

function validateModelExtensionFile(data: unknown): data is ModelExtensionFile {
  modelExtensionFileSchemaValidate(data);

  if (modelExtensionFileSchemaValidate.errors) {
    throw new Error(
      `Invalid data extension YAML: ${modelExtensionFileSchemaValidate.errors
        .map((error) => `${error.instancePath} ${error.message}`)
        .join(", ")}`,
    );
  }

  return true;
}

export function loadDataExtensionYaml(
  data: unknown,
): Record<string, ModeledMethod[]> | undefined {
  if (!validateModelExtensionFile(data)) {
    return undefined;
  }

  const extensions = data.extensions;

  const modeledMethods: Record<string, ModeledMethod[]> = {};

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
      const modeledMethod: ModeledMethod = definition.readModeledMethod(row);
      if (!modeledMethod) {
        continue;
      }

      if (!(modeledMethod.signature in modeledMethods)) {
        modeledMethods[modeledMethod.signature] = [];
      }

      modeledMethods[modeledMethod.signature].push(modeledMethod);
    }
  }

  return modeledMethods;
}
