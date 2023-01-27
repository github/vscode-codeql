import Ajv from "ajv";
import { JsonSchemaTypes } from "./json-schema-types";
import * as fs from "fs";
import { JSONSchema7 as JSONSchema } from "json-schema";

export class JsonValidator {
  ajv: Ajv;
  schemaTypes: string[];
  schemas: { [key: string]: JSONSchema };

  constructor(schemaTypes?: string[]) {
    this.ajv = new Ajv();
    this.schemaTypes = schemaTypes || JsonSchemaTypes;
    this.schemas = this.loadSchemas(this.schemaTypes);
  }

  public validate(object: unknown, typeName: string) {
    const validate = this.createValidatorFunction(typeName);

    const valid = validate(object);

    if (!valid) {
      throw new Error(
        `Object does not match the "${typeName}" schema: ${this.ajv.errorsText(
          validate.errors,
        )}`,
      );
    }
    return object;
  }

  private createValidatorFunction(typeName: string) {
    const schema = this.loadSchema(typeName);
    return this.ajv.compile(schema);
  }

  private loadSchemas(schemaTypes: string[]): { [key: string]: JSONSchema } {
    const schemaList: { [key: string]: JSONSchema } = {};

    for (const typeName of schemaTypes) {
      const schemaFilepath = `src/data-serialization/generated-schemas/${typeName}.json`;
      schemaList[typeName] = JSON.parse(
        fs.readFileSync(schemaFilepath, "utf-8"),
      );
    }
    return schemaList;
  }

  private loadSchema(typeName: string): JSONSchema {
    return this.schemas[typeName];
  }
}
