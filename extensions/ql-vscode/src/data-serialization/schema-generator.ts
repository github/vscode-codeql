import * as tjsg from "ts-json-schema-generator";
import * as fs from "fs";
import { JsonSchemaTypes } from "./json-schema-types";

export class SchemaGenerator {
  schemaTypes: string[];
  sourceFilePath: string;
  outputFilePath: string;

  constructor(
    schemaTypes?: string[],
    sourceFilePath?: string,
    outputFilePath?: string,
  ) {
    this.schemaTypes = schemaTypes || JsonSchemaTypes;
    this.sourceFilePath =
      sourceFilePath || "src/data-serialization/source-schema-types";
    this.outputFilePath =
      outputFilePath || "src/data-serialization/generated-schemas";
  }

  public async generateSchemas() {
    for (const typeName of this.schemaTypes) {
      const schemaContents = await this.generateSchema(typeName);
      await this.writeSchema(typeName, schemaContents);
    }
  }

  public async generateSchema(typeName: string): Promise<string> {
    console.log(`Generating schema for ${typeName}...`);

    const config = {
      path: `${this.sourceFilePath}/${typeName}.ts`,
      tsconfig: "tsconfig.json",
      type: typeName,
    };

    const generator = tjsg.createGenerator(config);
    const schema = generator.createSchema(config.type);
    return JSON.stringify(schema, null, 2);
  }

  public async writeSchema(typeName: string, schemaContents: string) {
    const output_path = `${this.outputFilePath}/${typeName}.json`;

    fs.writeFile(output_path, schemaContents, (err) => {
      if (err) throw err;
    });
  }
}

const generator = new SchemaGenerator();

generator.generateSchemas().catch((e) => {
  console.error(e);
  process.exit(2);
});
