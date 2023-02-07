import { join } from "path";
import { existsSync, rmdirSync } from "fs";
import { QlPackGenerator, QueryLanguage } from "../../../src/qlpack-generator";
import { CodeQLCliServer } from "../../../src/cli";

describe("QlPackGenerator", () => {
  let packfolderName: string;
  let qlPackYamlFilePath: string;
  let exampleQlFilePath: string;
  let language: string;
  let generator: QlPackGenerator;
  let packAddSpy: jest.SpyInstance;

  beforeEach(async () => {
    language = "ruby";
    packfolderName = `test-ql-pack-${language}`;
    qlPackYamlFilePath = join(packfolderName, "qlpack.yml");
    exampleQlFilePath = join(packfolderName, "example.ql");

    packAddSpy = jest.fn();
    const mockCli = {
      packAdd: packAddSpy,
    } as unknown as CodeQLCliServer;

    generator = new QlPackGenerator(
      packfolderName,
      language as QueryLanguage,
      mockCli,
    );
  });

  afterEach(async () => {
    try {
      rmdirSync(packfolderName, { recursive: true });
    } catch (e) {
      // ignore
    }
  });

  it("should generate a QL pack", async () => {
    expect(existsSync(packfolderName)).toBe(false);
    expect(existsSync(qlPackYamlFilePath)).toBe(false);
    expect(existsSync(exampleQlFilePath)).toBe(false);

    await generator.generate();

    expect(existsSync(packfolderName)).toBe(true);
    expect(existsSync(qlPackYamlFilePath)).toBe(true);
    expect(existsSync(exampleQlFilePath)).toBe(true);

    expect(packAddSpy).toHaveBeenCalledWith(packfolderName, language);
  });
});
