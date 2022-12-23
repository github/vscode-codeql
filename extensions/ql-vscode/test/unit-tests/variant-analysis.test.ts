import {
  VariantAnalysis,
  parseVariantAnalysisQueryLanguage,
  VariantAnalysisQueryLanguage,
  VariantAnalysisStatus,
  isVariantAnalysisComplete,
  VariantAnalysisRepoStatus,
  getActionsWorkflowRunUrl,
} from "../../src/remote-queries/shared/variant-analysis";
import { createMockScannedRepo } from "../../src/vscode-tests/factories/remote-queries/shared/scanned-repositories";
import { createMockVariantAnalysis } from "../../src/vscode-tests/factories/remote-queries/shared/variant-analysis";

describe("parseVariantAnalysisQueryLanguage", () => {
  it("parses a valid language", () => {
    expect(parseVariantAnalysisQueryLanguage("javascript")).toBe(
      VariantAnalysisQueryLanguage.Javascript,
    );
  });

  it("returns undefined for an valid language", () => {
    expect(parseVariantAnalysisQueryLanguage("rubbish")).toBeFalsy();
  });
});

describe("isVariantAnalysisComplete", () => {
  let variantAnalysis: VariantAnalysis;
  const uncallableArtifactDownloadChecker = () => {
    throw new Error("Should not be called");
  };

  beforeEach(() => {
    variantAnalysis = createMockVariantAnalysis({});
  });

  describe("when variant analysis status is InProgress", () => {
    beforeEach(() => {
      variantAnalysis.status = VariantAnalysisStatus.InProgress;
    });

    describe("when scanned repos is undefined", () => {
      it("should say the variant analysis is not complete", async () => {
        variantAnalysis.scannedRepos = undefined;
        expect(
          await isVariantAnalysisComplete(
            variantAnalysis,
            uncallableArtifactDownloadChecker,
          ),
        ).toBe(false);
      });
    });

    describe("when scanned repos is non-empty", () => {
      describe("when not all results are downloaded", () => {
        it("should say the variant analysis is not complete", async () => {
          expect(
            await isVariantAnalysisComplete(variantAnalysis, async () => false),
          ).toBe(false);
        });
      });

      describe("when all results are downloaded", () => {
        it("should say the variant analysis is complete", async () => {
          expect(
            await isVariantAnalysisComplete(variantAnalysis, async () => true),
          ).toBe(false);
        });
      });
    });
  });

  for (const variantAnalysisStatus of [
    VariantAnalysisStatus.Succeeded,
    VariantAnalysisStatus.Failed,
    VariantAnalysisStatus.Canceled,
  ]) {
    describe(`when variant analysis status is ${variantAnalysisStatus}`, () => {
      beforeEach(() => {
        variantAnalysis.status = variantAnalysisStatus;
      });

      describe("when scanned repos is undefined", () => {
        it("should say the variant analysis is complete", async () => {
          variantAnalysis.scannedRepos = undefined;
          expect(
            await isVariantAnalysisComplete(
              variantAnalysis,
              uncallableArtifactDownloadChecker,
            ),
          ).toBe(true);
        });
      });

      describe("when scanned repos is empty", () => {
        it("should say the variant analysis is complete", async () => {
          variantAnalysis.scannedRepos = [];
          expect(
            await isVariantAnalysisComplete(
              variantAnalysis,
              uncallableArtifactDownloadChecker,
            ),
          ).toBe(true);
        });
      });

      describe("when a repo scan is still in progress", () => {
        it("should say the variant analysis is not complete", async () => {
          variantAnalysis.scannedRepos = [
            createMockScannedRepo(
              "in-progress-repo",
              false,
              VariantAnalysisRepoStatus.InProgress,
            ),
          ];
          expect(
            await isVariantAnalysisComplete(variantAnalysis, async () => false),
          ).toBe(false);
        });
      });

      describe("when not all results are downloaded", () => {
        it("should say the variant analysis is not complete", async () => {
          variantAnalysis.scannedRepos = [
            createMockScannedRepo(
              "in-progress-repo",
              false,
              VariantAnalysisRepoStatus.Succeeded,
            ),
          ];
          expect(
            await isVariantAnalysisComplete(variantAnalysis, async () => false),
          ).toBe(false);
        });
      });

      describe("when all results are downloaded", () => {
        it("should say the variant analysis is complete", async () => {
          variantAnalysis.scannedRepos = [
            createMockScannedRepo(
              "in-progress-repo",
              false,
              VariantAnalysisRepoStatus.Succeeded,
            ),
          ];
          expect(
            await isVariantAnalysisComplete(variantAnalysis, async () => true),
          ).toBe(true);
        });
      });
    });
  }
});

describe("getActionsWorkflowRunUrl", () => {
  it("should get the run url", () => {
    const variantAnalysis = createMockVariantAnalysis({});

    const actionsWorkflowRunUrl = getActionsWorkflowRunUrl(variantAnalysis);

    expect(actionsWorkflowRunUrl).toBe(
      `https://github.com/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}`,
    );
  });
});
