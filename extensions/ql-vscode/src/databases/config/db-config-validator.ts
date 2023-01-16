import { readJsonSync } from "fs-extra";
import { resolve } from "path";
import Ajv from "ajv";
import { DbConfig } from "./db-config";
import { findDuplicateStrings } from "../../text-utils";
import {
  DbConfigValidationError,
  DbConfigValidationErrorKind,
} from "../db-validation-errors";

export class DbConfigValidator {
  private readonly schema: any;

  constructor(extensionPath: string) {
    const schemaPath = resolve(extensionPath, "databases-schema.json");
    this.schema = readJsonSync(schemaPath);
  }

  public validate(dbConfig: DbConfig): DbConfigValidationError[] {
    const ajv = new Ajv({ allErrors: true });
    ajv.validate(this.schema, dbConfig);

    if (ajv.errors) {
      return ajv.errors.map((error) => ({
        kind: DbConfigValidationErrorKind.InvalidConfig,
        message: `${error.instancePath} ${error.message}`,
      }));
    }

    return [
      ...this.validateDbListNames(dbConfig),
      ...this.validateDbNames(dbConfig),
      ...this.validateDbNamesInLists(dbConfig),
      ...this.validateOwners(dbConfig),
    ];
  }

  private validateDbListNames(dbConfig: DbConfig): DbConfigValidationError[] {
    const errors: DbConfigValidationError[] = [];

    const buildError = (dups: string[]) => ({
      kind: DbConfigValidationErrorKind.DuplicateNames,
      message: `There are database lists with the same name: ${dups.join(
        ", ",
      )}`,
    });

    const duplicateLocalDbLists = findDuplicateStrings(
      dbConfig.databases.local.lists.map((n) => n.name),
    );

    if (duplicateLocalDbLists.length > 0) {
      errors.push(buildError(duplicateLocalDbLists));
    }

    const duplicateRemoteDbLists = findDuplicateStrings(
      dbConfig.databases.variantAnalysis.repositoryLists.map((n) => n.name),
    );
    if (duplicateRemoteDbLists.length > 0) {
      errors.push(buildError(duplicateRemoteDbLists));
    }

    return errors;
  }

  private validateDbNames(dbConfig: DbConfig): DbConfigValidationError[] {
    const errors: DbConfigValidationError[] = [];

    const buildError = (dups: string[]) => ({
      kind: DbConfigValidationErrorKind.DuplicateNames,
      message: `There are databases with the same name: ${dups.join(", ")}`,
    });

    const duplicateLocalDbs = findDuplicateStrings(
      dbConfig.databases.local.databases.map((d) => d.name),
    );

    if (duplicateLocalDbs.length > 0) {
      errors.push(buildError(duplicateLocalDbs));
    }

    const duplicateRemoteDbs = findDuplicateStrings(
      dbConfig.databases.variantAnalysis.repositories,
    );
    if (duplicateRemoteDbs.length > 0) {
      errors.push(buildError(duplicateRemoteDbs));
    }

    return errors;
  }

  private validateDbNamesInLists(
    dbConfig: DbConfig,
  ): DbConfigValidationError[] {
    const errors: DbConfigValidationError[] = [];

    const buildError = (listName: string, dups: string[]) => ({
      kind: DbConfigValidationErrorKind.DuplicateNames,
      message: `There are databases with the same name in the ${listName} list: ${dups.join(
        ", ",
      )}`,
    });

    for (const list of dbConfig.databases.local.lists) {
      const dups = findDuplicateStrings(list.databases.map((d) => d.name));
      if (dups.length > 0) {
        errors.push(buildError(list.name, dups));
      }
    }

    for (const list of dbConfig.databases.variantAnalysis.repositoryLists) {
      const dups = findDuplicateStrings(list.repositories);
      if (dups.length > 0) {
        errors.push(buildError(list.name, dups));
      }
    }

    return errors;
  }

  private validateOwners(dbConfig: DbConfig): DbConfigValidationError[] {
    const errors: DbConfigValidationError[] = [];

    const dups = findDuplicateStrings(
      dbConfig.databases.variantAnalysis.owners,
    );
    if (dups.length > 0) {
      errors.push({
        kind: DbConfigValidationErrorKind.DuplicateNames,
        message: `There are owners with the same name: ${dups.join(", ")}`,
      });
    }
    return errors;
  }
}
