import { CancellationTokenSource } from "vscode";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { App } from "../../../../src/common/app";
import { QueryLanguage } from "../../../../src/common/query-language";
import { ExtensionApp } from "../../../../src/common/vscode/extension-app";
import { resolveCodeScanningQueryPack } from "../../../../src/variant-analysis/code-scanning-pack";
import { getActivatedExtension } from "../../global.helper";
import { useCompatiblePackDownloads } from "../pack-fixtures";

describe("Code Scanning pack", () => {
  let cli: CodeQLCliServer;
  let app: App;

  beforeEach(async () => {
    const extension = await getActivatedExtension();
    cli = extension.cliServer;
    app = new ExtensionApp(extension.ctx);
  });

  it("should download pack for correct language and identify problem queries", async () => {
    const packDownloadSpy = useCompatiblePackDownloads(cli);

    const pack = await resolveCodeScanningQueryPack(
      app.logger,
      cli,
      QueryLanguage.Javascript,
      new CancellationTokenSource().token,
    );
    expect(packDownloadSpy).toHaveBeenCalledWith(
      ["codeql/javascript-queries"],
      expect.anything(),
    );
    // Should include queries. Just check that at least one known query exists.
    // It doesn't particularly matter which query we check for.
    expect(
      pack.queryFiles.some((q) => q.includes("PostMessageStar.ql")),
    ).toBeTruthy();
    // Should not include non-problem queries.
    expect(
      pack.queryFiles.some((q) => q.includes("LinesOfCode.ql")),
    ).toBeFalsy();
  });
});
