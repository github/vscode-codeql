import { fail } from "assert";
import { expect } from "chai";
import * as sinon from "sinon";
import { Credentials } from "../../../../authentication";
import {
  cancelRemoteQuery,
  cancelVariantAnalysis,
  getRepositoriesMetadata,
} from "../../../../remote-queries/gh-api/gh-actions-api-client";
import { RemoteQuery } from "../../../../remote-queries/remote-query";
import { createMockVariantAnalysis } from "../../../factories/remote-queries/shared/variant-analysis";
import { VariantAnalysis } from "../../../../remote-queries/shared/variant-analysis";

describe("gh-actions-api-client mock responses", () => {
  let sandbox: sinon.SinonSandbox;
  let mockCredentials: Credentials;
  let mockResponse: sinon.SinonStub<any, Promise<{ status: number }>>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockCredentials = {
      getOctokit: () =>
        Promise.resolve({
          request: mockResponse,
        }),
    } as unknown as Credentials;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("cancelRemoteQuery", () => {
    it("should cancel a remote query", async () => {
      mockResponse = sinon.stub().resolves({ status: 202 });
      await cancelRemoteQuery(mockCredentials, createMockRemoteQuery());

      expect(mockResponse.calledOnce).to.be.true;
      expect(mockResponse.firstCall.args[0]).to.equal(
        "POST /repos/github/codeql/actions/runs/123/cancel",
      );
    });

    it("should fail to cancel a remote query", async () => {
      mockResponse = sinon
        .stub()
        .resolves({ status: 409, data: { message: "Uh oh!" } });

      await expect(
        cancelRemoteQuery(mockCredentials, createMockRemoteQuery()),
      ).to.be.rejectedWith(/Error cancelling variant analysis: 409 Uh oh!/);
      expect(mockResponse.calledOnce).to.be.true;
      expect(mockResponse.firstCall.args[0]).to.equal(
        "POST /repos/github/codeql/actions/runs/123/cancel",
      );
    });

    function createMockRemoteQuery(): RemoteQuery {
      return {
        actionsWorkflowRunId: 123,
        controllerRepository: {
          owner: "github",
          name: "codeql",
        },
      } as unknown as RemoteQuery;
    }
  });

  describe("cancelVariantAnalysis", () => {
    let variantAnalysis: VariantAnalysis;
    before(() => {
      variantAnalysis = createMockVariantAnalysis({});
    });

    it("should cancel a variant analysis", async () => {
      mockResponse = sinon.stub().resolves({ status: 202 });
      await cancelVariantAnalysis(mockCredentials, variantAnalysis);

      expect(mockResponse.calledOnce).to.be.true;
      expect(mockResponse.firstCall.args[0]).to.equal(
        `POST /repos/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}/cancel`,
      );
    });

    it("should fail to cancel a variant analysis", async () => {
      mockResponse = sinon
        .stub()
        .resolves({ status: 409, data: { message: "Uh oh!" } });

      await expect(
        cancelVariantAnalysis(mockCredentials, variantAnalysis),
      ).to.be.rejectedWith(/Error cancelling variant analysis: 409 Uh oh!/);
      expect(mockResponse.calledOnce).to.be.true;
      expect(mockResponse.firstCall.args[0]).to.equal(
        `POST /repos/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}/cancel`,
      );
    });
  });
});

describe("gh-actions-api-client real responses", function () {
  this.timeout(10000);

  it("should get the stargazers for repos", async () => {
    if (skip()) {
      return;
    }

    const credentials = await Credentials.initializeWithToken(
      process.env.VSCODE_CODEQL_GITHUB_TOKEN!,
    );
    const stargazers = await getRepositoriesMetadata(
      credentials,
      [
        "github/codeql",
        "github/vscode-codeql",
        "rails/rails",
        "angular/angular",
        "github/hucairz", // This one should not be in the list
      ],
      // choose a page size that is small enough to ensure we make multiple requests
      2,
    );

    const stargazersKeys = Object.keys(stargazers).sort();
    expect(stargazersKeys).to.deep.eq([
      "angular/angular",
      "github/codeql",
      "github/vscode-codeql",
      "rails/rails",
    ]);
  });

  function skip() {
    if (!process.env.VSCODE_CODEQL_GITHUB_TOKEN) {
      if (process.env.CI) {
        fail(
          "The VSCODE_CODEQL_GITHUB_TOKEN must be set to a valid GITHUB token on CI",
        );
      } else {
        console.log(
          "Skipping gh-actions-api-client real responses tests. To run these tests, set the value VSCODE_CODEQL_GITHUB_TOKEN to a GitHub token.",
        );
      }
      return true;
    }
    return false;
  }
});
