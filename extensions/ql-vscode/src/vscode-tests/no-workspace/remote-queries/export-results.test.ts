import { join } from "path";
import { readFile } from "fs-extra";
import { registerCredentials } from "../../../common/authentication";
import * as markdownGenerator from "../../../remote-queries/remote-queries-markdown-generation";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import { exportRemoteQueryAnalysisResults } from "../../../remote-queries/export-results";
import { TestCredentials } from "../../factories/authentication";
import { Disposable } from "../../../pure/disposable-object";

describe("export results", () => {
  describe("exportRemoteQueryAnalysisResults", () => {
    let credentialDisposer: Disposable;

    beforeEach(() => {
      jest.spyOn(markdownGenerator, "generateMarkdown").mockReturnValue([]);
      credentialDisposer = registerCredentials(
        TestCredentials.initializeWithStub(),
      );
    });

    afterEach(() => {
      credentialDisposer?.dispose();
    });

    it("should call the GitHub Actions API with the correct gist title", async function () {
      const mockCreateGist = jest
        .spyOn(ghApiClient, "createGist")
        .mockResolvedValue(undefined);

      const query = JSON.parse(
        await readFile(
          join(
            __dirname,
            "../data/remote-queries/query-with-results/query.json",
          ),
          "utf8",
        ),
      );
      const analysesResults = JSON.parse(
        await readFile(
          join(
            __dirname,
            "../data/remote-queries/query-with-results/analyses-results.json",
          ),
          "utf8",
        ),
      );

      await exportRemoteQueryAnalysisResults(
        "",
        query,
        analysesResults,
        "gist",
      );

      expect(mockCreateGist).toHaveBeenCalledTimes(1);
      expect(mockCreateGist).toHaveBeenCalledWith(
        "Shell command built from environment values (javascript) 3 results (10 repositories)",
        expect.anything(),
      );
    });
  });
});
