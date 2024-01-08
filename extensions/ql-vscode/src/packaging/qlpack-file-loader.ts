import Ajv from "ajv";
import type { QlPackFile } from "./qlpack-file";
import { load } from "js-yaml";
import { readFile } from "fs-extra";

import qlpackFileSchemaJson from "./qlpack-file.schema.json";

const ajv = new Ajv({ allErrors: true });
const qlpackFileValidate = ajv.compile(qlpackFileSchemaJson);

export async function loadQlpackFile(path: string): Promise<QlPackFile> {
  const qlpackFileText = await readFile(path, "utf8");

  let qlPack = load(qlpackFileText) as QlPackFile | undefined;

  if (qlPack === undefined || qlPack === null) {
    // An empty file is not valid according to the schema since it's not an object,
    // but it is equivalent to an empty object.
    qlPack = {};
  }

  qlpackFileValidate(qlPack);

  if (qlpackFileValidate.errors) {
    throw new Error(
      `Invalid extension pack YAML: ${qlpackFileValidate.errors
        .map((error) => `${error.instancePath} ${error.message}`)
        .join(", ")}`,
    );
  }

  return qlPack;
}
