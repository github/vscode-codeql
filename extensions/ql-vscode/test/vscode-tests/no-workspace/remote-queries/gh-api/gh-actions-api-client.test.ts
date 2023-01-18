import {
  cancelRemoteQuery,
  cancelVariantAnalysis,
  getRepositoriesMetadata,
} from "../../../../../src/remote-queries/gh-api/gh-actions-api-client";
import { RemoteQuery } from "../../../../../src/remote-queries/remote-query";
import { createMockVariantAnalysis } from "../../../../factories/remote-queries/shared/variant-analysis";
import { VariantAnalysis } from "../../../../../src/remote-queries/shared/variant-analysis";
import {
  testCredentialsWithStub,
  testCredentialsWithToken,
} from "../../../../factories/authentication";

jest.setTimeout(10000);

describe("gh-actions-api-client mock responses", () => {
  const mockRequest = jest.fn();
  const mockCredentials = testCredentialsWithStub(mockRequest);

  describe("cancelRemoteQuery", () => {
    it("should cancel a remote query", async () => {
      mockRequest.mockReturnValue({ status: 202 });
      await cancelRemoteQuery(mockCredentials, createMockRemoteQuery());

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        "POST /repos/github/codeql/actions/runs/123/cancel",
      );
    });

    it("should fail to cancel a remote query", async () => {
      mockRequest.mockResolvedValue({
        status: 409,
        data: { message: "Uh oh!" },
      });

      await expect(
        cancelRemoteQuery(mockCredentials, createMockRemoteQuery()),
      ).rejects.toThrow(/Error cancelling variant analysis: 409 Uh oh!/);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
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
    beforeAll(() => {
      variantAnalysis = createMockVariantAnalysis({});
    });

    it("should cancel a variant analysis", async () => {
      mockRequest.mockResolvedValue({ status: 202 });
      await cancelVariantAnalysis(mockCredentials, variantAnalysis);

      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        `POST /repos/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}/cancel`,
      );
    });

    it("should fail to cancel a variant analysis", async () => {
      mockRequest.mockResolvedValue({
        status: 409,
        data: { message: "Uh oh!" },
      });

      await expect(
        cancelVariantAnalysis(mockCredentials, variantAnalysis),
      ).rejects.toThrow(/Error cancelling variant analysis: 409 Uh oh!/);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        `POST /repos/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}/cancel`,
      );
    });
  });
});

describe("gh-actions-api-client real responses", () => {
  it("should get the stargazers for repos", async () => {
    if (skip()) {
      return;
    }

    const credentials = testCredentialsWithToken(
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
    expect(stargazersKeys).toEqual([
      "angular/angular",
      "github/codeql",
      "github/vscode-codeql",
      "rails/rails",
    ]);
  });

  function skip() {
    if (!process.env.VSCODE_CODEQL_GITHUB_TOKEN) {
      if (process.env.CI) {
        throw new Error(
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
