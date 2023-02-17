import { readJsonSync } from "fs-extra";
import { resolve } from "path";
import Ajv, { ValidateFunction } from "ajv";
import { clearLocalDbConfig, DbConfig } from "./db-config";
import { findDuplicateStrings } from "../../pure/text-utils";
import {
  DbConfigValidationError,
  DbConfigValidationErrorKind,
} from "../db-validation-errors";

export class DbConfigValidator {
  private readonly validateSchemaFn: ValidateFunction;

  constructor(extensionPath: string) {
    const schemaPath = resolve(extensionPath, "databases-schema.json");
    const schema = readJsonSync(schemaPath);
    const schemaValidator = new Ajv({ allErrors: true });
    this.validateSchemaFn = schemaValidator.compile(schema);
  }

  public validate(dbConfig: DbConfig): DbConfigValidationError[] {
    const localDbs = clearLocalDbConfig(dbConfig);

    this.validateSchemaFn(dbConfig);

    if (this.validateSchemaFn.errors) {
      return this.validateSchemaFn.errors.map((error) => ({
        kind: DbConfigValidationErrorKind.InvalidConfig,
        message: `${error.instancePath} ${error.message}`,
      }));
    }

    // Add any local db config back so that we have a config
    // object that respects its type and validation can happen
    // as normal.
    if (localDbs) {
      dbConfig.databases.local = localDbs;
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
