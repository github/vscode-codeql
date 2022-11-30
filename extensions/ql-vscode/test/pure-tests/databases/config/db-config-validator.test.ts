import { join } from "path";
import { DbConfig } from "../../../../src/databases/config/db-config";
import { DbConfigValidator } from "../../../../src/databases/config/db-config-validator";

describe("db config validation", () => {
  const extensionPath = join(__dirname, "../../../..");
  const configValidator = new DbConfigValidator(extensionPath);

  it("should return error when file is not valid", async () => {
    // We're intentionally bypassing the type check because we'd
    // like to make sure validation errors are highlighted.
    const dbConfig = {
      databases: {
        remote: {
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

    expect(validationOutput).toHaveLength(3);

    expect(validationOutput[0]).toEqual(
      "/databases must have required property 'local'",
    );
    expect(validationOutput[1]).toEqual(
      "/databases/remote must have required property 'owners'",
    );
    expect(validationOutput[2]).toEqual(
      "/databases/remote must NOT have additional properties",
    );
  });
});
