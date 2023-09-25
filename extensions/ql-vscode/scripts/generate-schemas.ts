import { createGenerator } from "ts-json-schema-generator";
import { join, resolve } from "path";
import { outputJSON } from "fs-extra";

const extensionDirectory = resolve(__dirname, "..");

const schemas = [
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

async function generateSchemas() {
  for (const schemaDefinition of schemas) {
    const schema = createGenerator({
      path: schemaDefinition.path,
      tsconfig: resolve(extensionDirectory, "tsconfig.json"),
      type: schemaDefinition.type,
      skipTypeCheck: true,
      topRef: true,
      additionalProperties: true,
    }).createSchema(schemaDefinition.type);

    await outputJSON(schemaDefinition.schemaPath, schema, {
      spaces: 2,
    });
  }
}

generateSchemas().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
