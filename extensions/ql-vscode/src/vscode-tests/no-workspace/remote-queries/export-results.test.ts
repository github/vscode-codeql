import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import * as sinon from "sinon";
import * as pq from "proxyquire";
import { ExtensionContext } from "vscode";
import { createMockExtensionContext } from "../index";
import { Credentials } from "../../../authentication";
import { MarkdownFile } from "../../../remote-queries/remote-queries-markdown-generation";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import { exportRemoteQueryAnalysisResults } from "../../../remote-queries/export-results";

const proxyquire = pq.noPreserveCache();

describe("export results", async function () {
  describe("exportRemoteQueryAnalysisResults", async function () {
    let sandbox: sinon.SinonSandbox;
    let mockCredentials: Credentials;
    let mockResponse: sinon.SinonStub<any, Promise<{ status: number }>>;
    let mockCreateGist: sinon.SinonStub;
    let ctx: ExtensionContext;

    beforeEach(() => {
      sandbox = sinon.createSandbox();

      mockCredentials = {
        getOctokit: () =>
          Promise.resolve({
            request: mockResponse,
          }),
      } as unknown as Credentials;
      sandbox.stub(Credentials, "initialize").resolves(mockCredentials);

      const resultFiles = [] as MarkdownFile[];
      proxyquire("../../../remote-queries/remote-queries-markdown-generation", {
        generateMarkdown: sinon.stub().returns(resultFiles),
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should call the GitHub Actions API with the correct gist title", async function () {
      mockCreateGist = sinon.stub(ghApiClient, "createGist");

      ctx = createMockExtensionContext();
      const query = JSON.parse(
        await fs.readFile(
          path.join(
            __dirname,
            "../data/remote-queries/query-with-results/query.json",
          ),
          "utf8",
        ),
      );
      const analysesResults = JSON.parse(
        await fs.readFile(
          path.join(
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

      expect(mockCreateGist.calledOnce).to.be.true;
      expect(mockCreateGist.firstCall.args[1]).to.equal(
        "Shell command built from environment values (javascript) 3 results (10 repositories)",
      );
    });
  });
});
