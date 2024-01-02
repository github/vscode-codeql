import Ajv from "ajv";
import * as qlpackFileSchemaJson from "./qlpack-file.schema.json";
import { QlPackFile } from "./qlpack-file";
import { load } from "js-yaml";
import { readFile } from "fs-extra";

const ajv = new Ajv({ allErrors: true });
const qlpackFileValidate = ajv.compile(qlpackFileSchemaJson);

export async function loadQlpackFile(path: string): Promise<QlPackFile> {
  const qlPack = load(await readFile(path, "utf8")) as QlPackFile | undefined;

  qlpackFileValidate(qlPack);

  if (qlpackFileValidate.errors) {
    throw new Error(
      `Invalid extension pack YAML: ${qlpackFileValidate.errors
        .map((error) => `${error.instancePath} ${error.message}`)
        .join(", ")}`,
    );
  }

  if (!qlPack) {
    throw new Error(`Could not parse ${path}`);
  }

  return qlPack;
}
