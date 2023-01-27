import Ajv, { ValidateFunction } from "ajv";
import { JsonSchemaTypes } from "./json-schema-types";
import * as fs from "fs";
import { JSONSchema7 as JSONSchema } from "json-schema";

export class JsonValidator {
  ajv: Ajv;
  schemaTypes: string[];
  schemas: { [key: string]: JSONSchema };
  validators: { [key: string]: ValidateFunction };

  constructor() {
    this.ajv = new Ajv();
    this.schemaTypes = JsonSchemaTypes;
    this.schemas = this.loadSchemas();
    this.validators = this.loadValidators();
  }

  public validate(object: unknown, typeName: string) {
    const validate = this.loadValidator(typeName);

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

  private loadSchemas(): { [key: string]: JSONSchema } {
    const schemaList: { [key: string]: JSONSchema } = {};

    for (const typeName of this.schemaTypes) {
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

  private loadValidators(): { [key: string]: ValidateFunction } {
    const validatorList: { [key: string]: ValidateFunction } = {};

    for (const typeName of this.schemaTypes) {
      validatorList[typeName] = this.createValidatorFunction(typeName);
    }
    return validatorList;
  }

  private loadValidator(typeName: string): ValidateFunction {
    return this.validators[typeName];
  }
}
