import { registerCredentials } from "../../../../common/authentication";
import {
  cancelRemoteQuery,
  cancelVariantAnalysis,
  getRepositoriesMetadata,
} from "../../../../remote-queries/gh-api/gh-actions-api-client";
import { RemoteQuery } from "../../../../remote-queries/remote-query";
import { createMockVariantAnalysis } from "../../../factories/remote-queries/shared/variant-analysis";
import { VariantAnalysis } from "../../../../remote-queries/shared/variant-analysis";
import { TestCredentials } from "../../../factories/authentication";
import { Disposable } from "../../../../pure/disposable-object";

jest.setTimeout(10000);

describe("gh-actions-api-client mock responses", () => {
  const mockRequest = jest.fn();
  let credentialDisposer: Disposable;

  beforeEach(() => {
    credentialDisposer = registerCredentials(
      TestCredentials.initializeWithStub(mockRequest),
    );
  });

  afterEach(() => {
    credentialDisposer?.dispose();
  });

  describe("cancelRemoteQuery", () => {
    it("should cancel a remote query", async () => {
      mockRequest.mockReturnValue({ status: 202 });
      await cancelRemoteQuery(createMockRemoteQuery());

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

      await expect(cancelRemoteQuery(createMockRemoteQuery())).rejects.toThrow(
        /Error cancelling variant analysis: 409 Uh oh!/,
      );
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
      await cancelVariantAnalysis(variantAnalysis);

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

      await expect(cancelVariantAnalysis(variantAnalysis)).rejects.toThrow(
        /Error cancelling variant analysis: 409 Uh oh!/,
      );
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(mockRequest).toHaveBeenCalledWith(
        `POST /repos/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}/cancel`,
      );
    });
  });
});

describe("gh-actions-api-client real responses", () => {
  let credentialDisposer: Disposable;

  beforeEach(() => {
    if (!skip()) {
      credentialDisposer = registerCredentials(
        TestCredentials.initializeWithToken(
          process.env.VSCODE_CODEQL_GITHUB_TOKEN!,
        ),
      );
    }
  });

  afterEach(() => {
    credentialDisposer?.dispose();
  });

  it("should get the stargazers for repos", async () => {
    if (skip()) {
      return;
    }

    const stargazers = await getRepositoriesMetadata(
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
