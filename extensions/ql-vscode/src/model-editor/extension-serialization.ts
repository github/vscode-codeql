import Ajv from "ajv";

import { load as loadYaml } from "js-yaml";
import { readFile } from "fs-extra";
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
import { join } from "path";

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const modelExtensionFileSchemaValidate = ajv.compile(modelExtensionFileSchema);

export enum ExtensionFormat {
  Yaml,
  Json,
}

export function getFileExtensionFromFormat(format: ExtensionFormat): string {
  switch (format) {
    case ExtensionFormat.Yaml:
      return ".yml";
    case ExtensionFormat.Json:
      return ".json";
    default:
      assertNever(format);
  }
}

function getFormatFromFileName(filename: string): ExtensionFormat {
  // Since YAML was originally the only format, any file that doesn't end with ".json" is considered YAML.
  return filename.endsWith(".json")
    ? ExtensionFormat.Json
    : ExtensionFormat.Yaml;
}

function stripExtension(filename: string): string {
  if (filename.endsWith(".json")) {
    return filename.slice(0, -5);
  }
  if (filename.endsWith(".yml")) {
    return filename.slice(0, -4);
  }
  // It mustn't be a file created by this editor.
  return filename;
}

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

export function createDataExtension(
  language: QueryLanguage,
  modeledMethods: readonly ModeledMethod[],
  format: ExtensionFormat,
): string {
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

  return modelExtensionFileToString({ extensions }, format);
}

export function createDataExtensionFiles(
  language: QueryLanguage,
  methods: readonly Method[],
  newModeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  existingModeledMethods: Readonly<
    Record<string, Record<string, readonly ModeledMethod[]>>
  >,
  mode: Mode,
  formatForNewFiles: ExtensionFormat,
): Record<string, string> {
  switch (mode) {
    case Mode.Application:
      return createDataExtensionFilesForApplicationMode(
        language,
        methods,
        newModeledMethods,
        existingModeledMethods,
        formatForNewFiles,
      );
    case Mode.Framework:
      return createDataExtensionFilesForFrameworkMode(
        language,
        methods,
        newModeledMethods,
        existingModeledMethods,
        formatForNewFiles,
      );
    default:
      assertNever(mode);
  }
}

function createDataExtensionFilesByGrouping(
  language: QueryLanguage,
  methods: readonly Method[],
  newModeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  existingModeledMethods: Readonly<
    Record<string, Record<string, readonly ModeledMethod[]>>
  >,
  createExtensionlessFilename: (method: Method) => string,
  formatForNewFiles: ExtensionFormat,
): Record<string, string> {
  // Keyed by canonical filenames without their file extensions, mapping to the actual filenames
  // with extensions. This allows us to preserve both the original capitalization of the filename
  // and its format, if it's an existing file.
  const actualFilenameByCanonicalExtensionlessFilename: Record<string, string> =
    {};

  const methodsByCanonicalExtensionlessFilename: Record<
    string,
    Record<string, ModeledMethod[]>
  > = {};

  // We only want to generate a file when it's a known external API usage
  // and there are new modeled methods for it. This avoids us overwriting other
  // files that may contain data we don't know about.
  for (const method of methods) {
    if (method.signature in newModeledMethods) {
      const extensionlessFilename = createExtensionlessFilename(method);
      const canonicalExtensionlessFilename = canonicalizeExtensionlessFilename(
        extensionlessFilename,
      );
      const actualFilename =
        extensionlessFilename + getFileExtensionFromFormat(formatForNewFiles);

      methodsByCanonicalExtensionlessFilename[canonicalExtensionlessFilename] =
        {};
      actualFilenameByCanonicalExtensionlessFilename[
        canonicalExtensionlessFilename
      ] = actualFilename;
    }
  }

  // First populate methodsByCanonicalExtensionlessFilename with any existing modeled methods.
  for (const [filename, methodsBySignature] of Object.entries(
    existingModeledMethods,
  )) {
    const canonicalExtensionlessFilename = canonicalizeExtensionlessFilename(
      stripExtension(filename),
    );

    if (
      canonicalExtensionlessFilename in methodsByCanonicalExtensionlessFilename
    ) {
      for (const [signature, methods] of Object.entries(methodsBySignature)) {
        methodsByCanonicalExtensionlessFilename[canonicalExtensionlessFilename][
          signature
        ] = [...methods];
      }

      // Ensure that if a file exists on disk, we use the same capitalization
      // as the original file.
      actualFilenameByCanonicalExtensionlessFilename[
        canonicalExtensionlessFilename
      ] = filename;
    }
  }

  // Add the new modeled methods, potentially overwriting existing modeled methods
  // but not removing existing modeled methods that are not in the new set.
  for (const method of methods) {
    const newMethods = newModeledMethods[method.signature];
    if (newMethods) {
      const extensionlessFilename = createExtensionlessFilename(method);
      const canonicalExtensionlessFilename = canonicalizeExtensionlessFilename(
        extensionlessFilename,
      );

      // Override any existing modeled methods with the new ones.
      methodsByCanonicalExtensionlessFilename[canonicalExtensionlessFilename][
        method.signature
      ] = [...newMethods];
    }
  }

  const result: Record<string, string> = {};

  for (const [canonicalExtensionlessFilename, methods] of Object.entries(
    methodsByCanonicalExtensionlessFilename,
  )) {
    const actualFilename =
      actualFilenameByCanonicalExtensionlessFilename[
        canonicalExtensionlessFilename
      ];
    result[actualFilename] = createDataExtension(
      language,
      Object.values(methods).flatMap((methods) => methods),
      getFormatFromFileName(actualFilename),
    );
  }

  return result;
}

export function createDataExtensionFilesForApplicationMode(
  language: QueryLanguage,
  methods: readonly Method[],
  newModeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  existingModeledMethods: Readonly<
    Record<string, Record<string, readonly ModeledMethod[]>>
  >,
  formatForNewFiles: ExtensionFormat,
): Record<string, string> {
  return createDataExtensionFilesByGrouping(
    language,
    methods,
    newModeledMethods,
    existingModeledMethods,
    (method) => createExtensionlessFilenameForLibrary(method.library),
    formatForNewFiles,
  );
}

export function createDataExtensionFilesForFrameworkMode(
  language: QueryLanguage,
  methods: readonly Method[],
  newModeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
  existingModeledMethods: Readonly<
    Record<string, Record<string, readonly ModeledMethod[]>>
  >,
  formatForNewFiles: ExtensionFormat,
): Record<string, string> {
  return createDataExtensionFilesByGrouping(
    language,
    methods,
    newModeledMethods,
    existingModeledMethods,
    (method) => createExtensionlessFilenameForPackage(method.packageName),
    formatForNewFiles,
  );
}

export function createExtensionlessFilenameForLibrary(
  library: string,
  prefix = "models/",
  suffix = ".model",
) {
  return `${prefix}${createFilenameFromString(library)}${suffix}`;
}

export function createExtensionlessFilenameForPackage(
  packageName: string,
  prefix = "models/",
  suffix = ".model",
) {
  // A package name is e.g. `com.google.common.io` or `System.Net.Http.Headers`
  // We want to place these into `models/com.google.common.io.model.yml` and
  // `models/System.Net.Http.Headers.model.yml` respectively.
  return `${prefix}${packageName}${suffix}`;
}

function canonicalizeExtensionlessFilename(filename: string) {
  // We want to canonicalize filenames so that they are always in the same format
  // for comparison purposes. This is important because we want to avoid overwriting
  // data extension files on case-insensitive file systems.
  return filename.toLowerCase();
}

function validateModelExtensionFile(data: unknown): data is ModelExtensionFile {
  modelExtensionFileSchemaValidate(data);

  if (modelExtensionFileSchemaValidate.errors) {
    throw new Error(
      `Invalid data extension file: ${modelExtensionFileSchemaValidate.errors
        .map((error) => `${error.instancePath} ${error.message}`)
        .join(", ")}`,
    );
  }

  return true;
}

/**
 * Creates a string for the data extension file in the given format from the structure of the data
 * extension file. This should be used instead of creating a JSON string directly or dumping the
 * YAML directly to ensure that the file is formatted correctly.
 *
 * @param data The data extension file
 * @param format The format to serialize the data extension file to
 * @param headerComment An optional header comment to include at the top of the file
 */
export function modelExtensionFileToString(
  data: ModelExtensionFile,
  format: ExtensionFormat,
  headerComment?: string,
): string {
  switch (format) {
    case ExtensionFormat.Yaml:
      return modelExtensionFileToYaml(data, headerComment);
    case ExtensionFormat.Json:
      return modelExtensionFileToJson(data, headerComment);
    default:
      assertNever(format);
  }
}

function modelExtensionFileToYaml(
  data: ModelExtensionFile,
  headerComment?: string,
): string {
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

  return `${headerComment ? `# ${headerComment}\n\n` : ""}extensions:
${extensions.join("\n")}`;
}

function modelExtensionFileToJson(
  data: ModelExtensionFile,
  headerComment?: string,
): string {
  const extensions = data.extensions
    .map((extension) => {
      const data =
        extension.data.length === 0
          ? "[]"
          : `[\n${extension.data
              .map((row) => `        ${JSON.stringify(row)}`)
              .join(",\n")}\n      ]`;

      return `{
      "addsTo": {
        "pack": "${extension.addsTo.pack}",
        "extensible": "${extension.addsTo.extensible}"
      },
      "data": ${data}
    }`;
    })
    .filter((extensions) => extensions !== "");

  return `${headerComment ? `// ${headerComment}\n\n` : ""}{
  "extensions": [
    ${extensions.join(",\n    ")}
  ]
}`;
}

function deserializeToObject(contents: string, filename: string) {
  const format = getFormatFromFileName(filename);
  switch (format) {
    case ExtensionFormat.Yaml:
      return loadYaml(contents, {
        filename,
      });
    case ExtensionFormat.Json:
      throw new Error(`JSON format not supported yet`);
    default:
      assertNever(format);
  }
}

export async function loadDataExtension(
  extensionPackPath: string,
  filename: string,
  language: QueryLanguage,
): Promise<Record<string, ModeledMethod[]> | undefined> {
  const fileContents = await readFile(
    join(extensionPackPath, filename),
    "utf8",
  );
  return loadDataExtensionFromString(fileContents, filename, language);
}

export function loadDataExtensionFromString(
  fileContents: string,
  filename: string,
  language: QueryLanguage,
): Record<string, ModeledMethod[]> | undefined {
  const data = deserializeToObject(fileContents, filename);
  return loadDataExtensionFromObject(data, language);
}

export function loadDataExtensionFromObject(
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
