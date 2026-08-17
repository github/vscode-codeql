import type { CodeQLCliServer } from "../../../src/codeql-cli/cli";

// Most of these versions were published by CLI 2.26.2 and are the newest
// versions whose manifests can be read by every supported CLI. Older test
// fixtures use their latest known compatible releases.
const COMPATIBLE_PACK_VERSIONS: Readonly<Record<string, string>> = {
  "codeql/actions-queries": "0.6.32",
  "codeql/concepts": "0.0.28",
  "codeql/cpp-queries": "1.8.0",
  "codeql/csharp-queries": "1.9.0",
  "codeql/csharp-solorigate-queries": "1.0.1",
  "codeql/dataflow": "2.1.10",
  "codeql/go-queries": "1.6.7",
  "codeql/java-queries": "1.11.7",
  "codeql/javascript-all": "2.8.2",
  "codeql/javascript-queries": "2.4.2",
  "codeql/mad": "1.0.54",
  "codeql/python-queries": "1.8.7",
  "codeql/regex": "1.0.54",
  "codeql/ruby-queries": "1.6.7",
  "codeql/rust-queries": "0.1.39",
  "codeql/ssa": "2.0.30",
  "codeql/threat-models": "1.0.54",
  "codeql/tutorial": "1.0.54",
  "codeql/typetracking": "2.0.38",
  "codeql/util": "2.0.41",
  "codeql/xml": "1.0.54",
  "codeql/yaml": "1.0.54",
};

export const AUTHENTICATION_TEST_PACK = "codeql/tutorial@0.0.11";

export const QUICK_QUERY_PACK_DEPENDENCIES = [
  "codeql/concepts",
  "codeql/dataflow",
  "codeql/javascript-all",
  "codeql/mad",
  "codeql/regex",
  "codeql/ssa",
  "codeql/threat-models",
  "codeql/tutorial",
  "codeql/typetracking",
  "codeql/util",
  "codeql/xml",
  "codeql/yaml",
] as const;

export function getCompatiblePackVersion(packName: string): string {
  const version = COMPATIBLE_PACK_VERSIONS[packName];
  if (!version) {
    throw new Error(
      `No compatible CLI test version configured for ${packName}`,
    );
  }
  return version;
}

export function getCompatiblePackSpec(packName: string): string {
  return `${packName}@${getCompatiblePackVersion(packName)}`;
}

export function getCompatiblePackLock(packNames: readonly string[]) {
  return {
    lockVersion: "1.0.0",
    dependencies: Object.fromEntries(
      packNames.map((packName) => [
        packName,
        { version: getCompatiblePackVersion(packName) },
      ]),
    ),
    compiled: false,
  };
}

export function useCompatiblePackDownloads(
  cli: CodeQLCliServer,
): jest.SpiedFunction<CodeQLCliServer["packDownload"]> {
  const packDownload = cli.packDownload.bind(cli);
  return jest
    .spyOn(cli, "packDownload")
    .mockImplementation((packs, token) =>
      packDownload(packs.map(getCompatiblePackSpec), token),
    );
}
