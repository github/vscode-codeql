import { createGenerator } from "ts-json-schema-generator";
import { join, resolve } from "path";
import { outputFile } from "fs-extra";
import { format, resolveConfig } from "prettier";

const extensionDirectory = resolve(__dirname, "..");

const schemas = [
  {
    path: join(extensionDirectory, "src", "packaging", "qlpack-file.ts"),
    type: "QlPackFile",
    schemaPath: join(
      extensionDirectory,
      "src",
      "packaging",
      "qlpack-file.schema.json",
    ),
  },
  {
    path: join(
      extensionDirectory,
      "src",
      "model-editor",
      "extension-pack-metadata.ts",
    ),
    type: "ExtensionPackMetadata",
    schemaPath: join(
      extensionDirectory,
      "src",
      "model-editor",
      "extension-pack-metadata.schema.json",
    ),
  },
  {
    path: join(
      extensionDirectory,
      "src",
      "model-editor",
      "model-extension-file.ts",
    ),
    type: "ModelExtensionFile",
    schemaPath: join(
      extensionDirectory,
      "src",
      "model-editor",
      "model-extension-file.schema.json",
    ),
  },
];

async function generateSchema(
  schemaDefinition: (typeof schemas)[number],
): Promise<void> {
  const schema = createGenerator({
    path: schemaDefinition.path,
    tsconfig: resolve(extensionDirectory, "tsconfig.json"),
    type: schemaDefinition.type,
    skipTypeCheck: true,
    topRef: true,
    additionalProperties: true,
  }).createSchema(schemaDefinition.type);

  const schemaJson = JSON.stringify(schema, null, 2);

  const prettierOptions = await resolveConfig(schemaDefinition.schemaPath);

  const formattedSchemaJson = await format(schemaJson, {
    ...prettierOptions,
    filepath: schemaDefinition.schemaPath,
  });

  await outputFile(schemaDefinition.schemaPath, formattedSchemaJson);
}

async function generateSchemas() {
  await Promise.all(schemas.map(generateSchema));
}

generateSchemas().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
