import Ajv from "ajv";

import type { Method } from "./method";
import type {
  ModeledMethod,
  NeutralModeledMethod,
  SinkModeledMethod,
  SourceModeledMethod,
  SummaryModeledMethod,
  TypeModeledMethod,
} from "./modeled-method";
import type {
  ModelsAsDataLanguagePredicate,
  ModelsAsDataLanguagePredicates,
} from "./languages";
import { getModelsAsDataLanguage } from "./languages";
import { Mode } from "./shared/mode";
import { assertNever } from "../common/helpers-pure";
import type {
  ModelExtension,
  ModelExtensionFile,
} from "./model-extension-file";
import { createFilenameFromString } from "../common/filenames";
import type { QueryLanguage } from "../common/query-language";

import modelExtensionFileSchema from "./model-extension-file.schema.json";

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const modelExtensionFileSchemaValidate = ajv.compile(modelExtensionFileSchema);

function createExtensions<T>(
  language: QueryLanguage,
  methods: readonly T[],
  definition: ModelsAsDataLanguagePredicate<T> | undefined,
): ModelExtension | undefined {
  if (!definition) {
    return undefined;
  }

  return {
    addsTo: {
      pack: `codeql/${language}-all`,
      extensible: definition.extensiblePredicate,
    },
    data: methods.map((method) => definition.generateMethodDefinition(method)),
  };
}

export function createDataExtensionYaml(
  language: QueryLanguage,
  modeledMethods: readonly ModeledMethod[],
) {
  const modelsAsDataLanguage = getModelsAsDataLanguage(language);

  const methodsByType = {
    source: [] as SourceModeledMethod[],
    sink: [] as SinkModeledMethod[],
    summary: [] as SummaryModeledMethod[],
    neutral: [] as NeutralModeledMethod[],
    type: [] as TypeModeledMethod[],
  } satisfies Record<keyof ModelsAsDataLanguagePredicates, ModeledMethod[]>;

  for (const modeledMethod of modeledMethods) {
    if (!modeledMethod?.type || modeledMethod.type === "none") {
      continue;
    }

    switch (modeledMethod.type) {
      case "source":
        methodsByType.source.push(modeledMethod);
        break;
      case "sink":
        methodsByType.sink.push(modeledMethod);
        break;
      case "summary":
        methodsByType.summary.push(modeledMethod);
        break;
      case "neutral":
        methodsByType.neutral.push(modeledMethod);
        break;
      case "type":
        methodsByType.type.push(modeledMethod);
        break;
      default:
        assertNever(modeledMethod);
    }
  }

  const extensions = Object.keys(methodsByType)
    .map((typeKey): ModelExtension | undefined => {
      const type = typeKey as keyof ModelsAsDataLanguagePredicates;

      switch (type) {
        case "source":
          return createExtensions(
            language,
            methodsByType.source,
            modelsAsDataLanguage.predicates.source,
          );
        case "sink":
          return createExtensions(
            language,
            methodsByType.sink,
            modelsAsDataLanguage.predicates.sink,
          );
        case "summary":
          return createExtensions(
            language,
            methodsByType.summary,
            modelsAsDataLanguage.predicates.summary,
          );
        case "neutral":
          return createExtensions(
            language,
            methodsByType.neutral,
            modelsAsDataLanguage.predicates.neutral,
          );
        case "type":
          return createExtensions(
            language,
            methodsByType.type,
            modelsAsDataLanguage.predicates.type,
          );
        default:
          assertNever(type);
      }
    })
    .filter(
      (extension): extension is ModelExtension => extension !== undefined,
    );

  return modelExtensionFileToYaml({ extensions });
}

export function createDataExtensionYamls(
  language: QueryLanguage,
  methods: readonly Method[],
  newModeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  existingModeledMethods: Readonly<
    Record<string, Record<string, readonly ModeledMethod[]>>
  >,
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
  language: QueryLanguage,
  methods: readonly Method[],
  newModeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  existingModeledMethods: Readonly<
    Record<string, Record<string, readonly ModeledMethod[]>>
  >,
  createFilename: (method: Method) => string,
): Record<string, string> {
  const actualFilenameByCanonicalFilename: Record<string, string> = {};

  const methodsByCanonicalFilename: Record<
    string,
    Record<string, ModeledMethod[]>
  > = {};

  // We only want to generate a yaml file when it's a known external API usage
  // and there are new modeled methods for it. This avoids us overwriting other
  // files that may contain data we don't know about.
  for (const method of methods) {
    if (method.signature in newModeledMethods) {
      const filename = createFilename(method);
      const canonicalFilename = canonicalizeFilename(filename);

      methodsByCanonicalFilename[canonicalFilename] = {};
      actualFilenameByCanonicalFilename[canonicalFilename] = filename;
    }
  }

  // First populate methodsByFilename with any existing modeled methods.
  for (const [filename, methodsBySignature] of Object.entries(
    existingModeledMethods,
  )) {
    const canonicalFilename = canonicalizeFilename(filename);

    if (canonicalFilename in methodsByCanonicalFilename) {
      for (const [signature, methods] of Object.entries(methodsBySignature)) {
        methodsByCanonicalFilename[canonicalFilename][signature] = [...methods];
      }

      // Ensure that if a file exists on disk, we use the same capitalization
      // as the original file.
      actualFilenameByCanonicalFilename[canonicalFilename] = filename;
    }
  }

  // Add the new modeled methods, potentially overwriting existing modeled methods
  // but not removing existing modeled methods that are not in the new set.
  for (const method of methods) {
    const newMethods = newModeledMethods[method.signature];
    if (newMethods) {
      const filename = createFilename(method);
      const canonicalFilename = canonicalizeFilename(filename);

      // Override any existing modeled methods with the new ones.
      methodsByCanonicalFilename[canonicalFilename][method.signature] = [
        ...newMethods,
      ];
    }
  }

  const result: Record<string, string> = {};

  for (const [canonicalFilename, methods] of Object.entries(
    methodsByCanonicalFilename,
  )) {
    result[actualFilenameByCanonicalFilename[canonicalFilename]] =
      createDataExtensionYaml(
        language,
        Object.values(methods).flatMap((methods) => methods),
      );
  }

  return result;
}

export function createDataExtensionYamlsForApplicationMode(
  language: QueryLanguage,
  methods: readonly Method[],
  newModeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  existingModeledMethods: Readonly<
    Record<string, Record<string, readonly ModeledMethod[]>>
  >,
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
  language: QueryLanguage,
  methods: readonly Method[],
  newModeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  existingModeledMethods: Readonly<
    Record<string, Record<string, readonly ModeledMethod[]>>
  >,
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
  return `${prefix}${createFilenameFromString(library)}${suffix}.yml`;
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

function canonicalizeFilename(filename: string) {
  // We want to canonicalize filenames so that they are always in the same format
  // for comparison purposes. This is important because we want to avoid overwriting
  // data extension YAML files on case-insensitive file systems.
  return filename.toLowerCase();
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

/**
 * Creates a string for the data extension YAML file from the
 * structure of the data extension file. This should be used
 * instead of creating a JSON string directly or dumping the
 * YAML directly to ensure that the file is formatted correctly.
 *
 * @param data The data extension file
 */
export function modelExtensionFileToYaml(data: ModelExtensionFile) {
  const extensions = data.extensions
    .map((extension) => {
      const data =
        extension.data.length === 0
          ? " []"
          : `\n${extension.data
              .map((row) => `      - ${JSON.stringify(row)}`)
              .join("\n")}`;

      return `  - addsTo:
      pack: ${extension.addsTo.pack}
      extensible: ${extension.addsTo.extensible}
    data:${data}
`;
    })
    .filter((extensions) => extensions !== "");

  return `extensions:
${extensions.join("\n")}`;
}

export function loadDataExtensionYaml(
  data: unknown,
  language: QueryLanguage,
): Record<string, ModeledMethod[]> | undefined {
  if (!validateModelExtensionFile(data)) {
    return undefined;
  }

  const modelsAsDataLanguage = getModelsAsDataLanguage(language);

  const extensions = data.extensions;

  const modeledMethods: Record<string, ModeledMethod[]> = {};

  for (const extension of extensions) {
    const addsTo = extension.addsTo;
    const extensible = addsTo.extensible;
    const data = extension.data;

    const definition = Object.values(modelsAsDataLanguage.predicates).find(
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
