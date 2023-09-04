import Ajv from "ajv";

import { Method } from "./method";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import {
  ExtensiblePredicateDefinition,
  extensiblePredicateDefinitions,
} from "./predicates";

import * as dataSchemaJson from "./data-schema.json";
import { sanitizeExtensionPackName } from "./extension-pack-name";
import { Mode } from "./shared/mode";
import { assertNever } from "../common/helpers-pure";

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

export function createDataExtensionYamls(
  databaseName: string,
  language: string,
  methods: Method[],
  newModeledMethods: Record<string, ModeledMethod>,
  existingModeledMethods: Record<string, Record<string, ModeledMethod>>,
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
        databaseName,
        language,
        methods,
        newModeledMethods,
        existingModeledMethods,
      );
    default:
      assertNever(mode);
  }
}

export function createDataExtensionYamlsForApplicationMode(
  language: string,
  methods: Method[],
  newModeledMethods: Record<string, ModeledMethod>,
  existingModeledMethods: Record<string, Record<string, ModeledMethod>>,
): Record<string, string> {
  const methodsByLibraryFilename: Record<
    string,
    Record<string, ModeledMethod>
  > = {};

  // We only want to generate a yaml file when it's a known external API usage
  // and there are new modeled methods for it. This avoids us overwriting other
  // files that may contain data we don't know about.
  for (const method of methods) {
    if (method.signature in newModeledMethods) {
      methodsByLibraryFilename[createFilenameForLibrary(method.library)] = {};
    }
  }

  // First populate methodsByLibraryFilename with any existing modeled methods.
  for (const [filename, methods] of Object.entries(existingModeledMethods)) {
    if (filename in methodsByLibraryFilename) {
      for (const [signature, method] of Object.entries(methods)) {
        methodsByLibraryFilename[filename][signature] = method;
      }
    }
  }

  // Add the new modeled methods, potentially overwriting existing modeled methods
  // but not removing existing modeled methods that are not in the new set.
  for (const method of methods) {
    const newMethod = newModeledMethods[method.signature];
    if (newMethod) {
      const filename = createFilenameForLibrary(method.library);
      methodsByLibraryFilename[filename][newMethod.signature] = newMethod;
    }
  }

  const result: Record<string, string> = {};

  for (const [filename, methods] of Object.entries(methodsByLibraryFilename)) {
    result[filename] = createDataExtensionYaml(
      language,
      Object.values(methods),
    );
  }

  return result;
}

export function createDataExtensionYamlsForFrameworkMode(
  databaseName: string,
  language: string,
  unmodeledMethods: Method[],
  newModeledMethods: Record<string, ModeledMethod>,
  existingModeledMethods: Record<string, Record<string, ModeledMethod>>,
  prefix = "models/",
  suffix = ".model",
): Record<string, string> {
  const parts = databaseName.split("/");
  const libraryName = parts
    .slice(1)
    .map((part) => sanitizeExtensionPackName(part))
    .join("-");
  const filename = `${prefix}${libraryName}${suffix}.yml`;

  const methods: Record<string, ModeledMethod> = {};

  // First populate methodsByLibraryFilename with any existing modeled methods.
  for (const [signature, method] of Object.entries(
    existingModeledMethods[filename] || {},
  )) {
    methods[signature] = method;
  }

  // Add the new modeled methods, potentially overwriting existing modeled methods
  // but not removing existing modeled methods that are not in the new set.
  for (const method of unmodeledMethods) {
    const modeledMethod = newModeledMethods[method.signature];
    if (modeledMethod) {
      methods[modeledMethod.signature] = modeledMethod;
    }
  }

  return {
    [filename]: createDataExtensionYaml(language, Object.values(methods)),
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
