import { join } from "path";
import { readFile } from "fs-extra";
import { createMockExtensionContext } from "../index";
import { Credentials } from "../../../authentication";
import * as markdownGenerator from "../../../remote-queries/remote-queries-markdown-generation";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import { exportRemoteQueryAnalysisResults } from "../../../remote-queries/export-results";

describe("export results", () => {
  describe("exportRemoteQueryAnalysisResults", () => {
    const mockCredentials = {} as unknown as Credentials;

    beforeEach(() => {
      jest.spyOn(markdownGenerator, "generateMarkdown").mockReturnValue([]);
      jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);
    });

    it("should call the GitHub Actions API with the correct gist title", async function () {
      const mockCreateGist = jest
        .spyOn(ghApiClient, "createGist")
        .mockResolvedValue(undefined);

      const ctx = createMockExtensionContext();
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
        ctx,
        "",
        query,
        analysesResults,
        "gist",
      );

      expect(mockCreateGist).toHaveBeenCalledTimes(1);
      expect(mockCreateGist).toHaveBeenCalledWith(
        expect.anything(),
        "Shell command built from environment values (javascript) 3 results (10 repositories)",
        expect.anything(),
      );
    });
  });
});
