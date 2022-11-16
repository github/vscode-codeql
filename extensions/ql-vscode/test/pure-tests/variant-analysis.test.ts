import { expect } from "chai";
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
    expect(parseVariantAnalysisQueryLanguage("javascript")).to.equal(
      VariantAnalysisQueryLanguage.Javascript,
    );
  });

  it("returns undefined for an valid language", () => {
    expect(parseVariantAnalysisQueryLanguage("rubbish")).to.not.exist;
  });
});

describe("isVariantAnalysisComplete", async () => {
  let variantAnalysis: VariantAnalysis;
  const uncallableArtifactDownloadChecker = () => {
    throw new Error("Should not be called");
  };

  beforeEach(() => {
    variantAnalysis = createMockVariantAnalysis({});
  });

  describe("when variant analysis status is InProgress", async () => {
    beforeEach(() => {
      variantAnalysis.status = VariantAnalysisStatus.InProgress;
    });

    describe("when scanned repos is undefined", async () => {
      it("should say the variant analysis is not complete", async () => {
        variantAnalysis.scannedRepos = undefined;
        expect(
          await isVariantAnalysisComplete(
            variantAnalysis,
            uncallableArtifactDownloadChecker,
          ),
        ).to.equal(false);
      });
    });

    describe("when scanned repos is non-empty", async () => {
      describe("when not all results are downloaded", async () => {
        it("should say the variant analysis is not complete", async () => {
          expect(
            await isVariantAnalysisComplete(variantAnalysis, async () => false),
          ).to.equal(false);
        });
      });

      describe("when all results are downloaded", async () => {
        it("should say the variant analysis is complete", async () => {
          expect(
            await isVariantAnalysisComplete(variantAnalysis, async () => true),
          ).to.equal(false);
        });
      });
    });
  });

  for (const variantAnalysisStatus of [
    VariantAnalysisStatus.Succeeded,
    VariantAnalysisStatus.Failed,
    VariantAnalysisStatus.Canceled,
  ]) {
    describe(`when variant analysis status is ${variantAnalysisStatus}`, async () => {
      beforeEach(() => {
        variantAnalysis.status = variantAnalysisStatus;
      });

      describe("when scanned repos is undefined", async () => {
        it("should say the variant analysis is complete", async () => {
          variantAnalysis.scannedRepos = undefined;
          expect(
            await isVariantAnalysisComplete(
              variantAnalysis,
              uncallableArtifactDownloadChecker,
            ),
          ).to.equal(true);
        });
      });

      describe("when scanned repos is empty", async () => {
        it("should say the variant analysis is complete", async () => {
          variantAnalysis.scannedRepos = [];
          expect(
            await isVariantAnalysisComplete(
              variantAnalysis,
              uncallableArtifactDownloadChecker,
            ),
          ).to.equal(true);
        });
      });

      describe("when a repo scan is still in progress", async () => {
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
          ).to.equal(false);
        });
      });

      describe("when not all results are downloaded", async () => {
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
          ).to.equal(false);
        });
      });

      describe("when all results are downloaded", async () => {
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
          ).to.equal(true);
        });
      });
    });
  }
});

describe("getActionsWorkflowRunUrl", () => {
  it("should get the run url", () => {
    const variantAnalysis = createMockVariantAnalysis({});

    const actionsWorkflowRunUrl = getActionsWorkflowRunUrl(variantAnalysis);

    expect(actionsWorkflowRunUrl).to.equal(
      `https://github.com/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}`,
    );
  });
});
