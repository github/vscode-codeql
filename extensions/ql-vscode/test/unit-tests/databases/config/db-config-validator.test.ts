import { join } from "path";
import type { DbConfig } from "../../../../src/databases/config/db-config";
import { DB_CONFIG_VERSION } from "../../../../src/databases/config/db-config";
import { DbConfigValidator } from "../../../../src/databases/config/db-config-validator";
import { DbConfigValidationErrorKind } from "../../../../src/databases/db-validation-errors";
import { createDbConfig } from "../../../factories/db-config-factories";

describe("db config validation", () => {
  const extensionPath = join(__dirname, "../../../..");
  const configValidator = new DbConfigValidator(extensionPath);

  it("should return error when file is not valid", async () => {
    // We're intentionally bypassing the type check because we'd
    // like to make sure validation errors are highlighted.
    const dbConfig = {
      version: DB_CONFIG_VERSION,
      databases: {
        variantAnalysis: {
          repositoryLists: [
            {
              name: "repoList1",
              repositories: ["foo/bar", "foo/baz"],
            },
          ],
          repositories: ["owner/repo1", "owner/repo2", "owner/repo3"],
          somethingElse: "bar",
        },
      },
    } as any as DbConfig;

    const validationOutput = configValidator.validate(dbConfig);

    expect(validationOutput).toHaveLength(2);

    expect(validationOutput[0]).toEqual({
      kind: DbConfigValidationErrorKind.InvalidConfig,
      message:
        "/databases/variantAnalysis must have required property 'owners'",
    });
    expect(validationOutput[1]).toEqual({
      kind: DbConfigValidationErrorKind.InvalidConfig,
      message: "/databases/variantAnalysis must NOT have additional properties",
    });
  });

  it("should return error when there are multiple remote db lists with the same name", async () => {
    const dbConfig = createDbConfig({
      remoteLists: [
        {
          name: "repoList1",
          repositories: ["owner1/repo1", "owner1/repo2"],
        },
        {
          name: "repoList1",
          repositories: ["owner2/repo1", "owner2/repo2"],
        },
      ],
    });

    const validationOutput = configValidator.validate(dbConfig);

    expect(validationOutput).toHaveLength(1);
    expect(validationOutput[0]).toEqual({
      kind: DbConfigValidationErrorKind.DuplicateNames,
      message: "There are database lists with the same name: repoList1",
    });
  });

  it("should return error when there are multiple remote dbs with the same name", async () => {
    const dbConfig = createDbConfig({
      remoteRepos: ["owner1/repo1", "owner1/repo2", "owner1/repo2"],
    });

    const validationOutput = configValidator.validate(dbConfig);

    expect(validationOutput).toHaveLength(1);
    expect(validationOutput[0]).toEqual({
      kind: DbConfigValidationErrorKind.DuplicateNames,
      message: "There are databases with the same name: owner1/repo2",
    });
  });

  it("should return error when there are multiple remote dbs with the same name in the same list", async () => {
    const dbConfig = createDbConfig({
      remoteLists: [
        {
          name: "repoList1",
          repositories: ["owner1/repo1", "owner1/repo2", "owner1/repo2"],
        },
      ],
    });

    const validationOutput = configValidator.validate(dbConfig);

    expect(validationOutput).toHaveLength(1);
    expect(validationOutput[0]).toEqual({
      kind: DbConfigValidationErrorKind.DuplicateNames,
      message:
        "There are databases with the same name in the repoList1 list: owner1/repo2",
    });
  });
});
