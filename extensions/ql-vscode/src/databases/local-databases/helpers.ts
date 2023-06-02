import { CodeQLCliServer } from "../../codeql-cli/cli";

export async function getPrimaryLanguage(
  cliServer: CodeQLCliServer,
  dbPath: string,
): Promise<string> {
  const dbInfo = await cliServer.resolveDatabase(dbPath);
  return dbInfo.languages?.[0] || "";
}
