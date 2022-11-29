import * as sinon from "sinon";
import { expect } from "chai";
import { CancellationTokenSource, commands, extensions } from "vscode";
import { CodeQLExtensionInterface } from "../../../extension";
import * as config from "../../../config";

import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import { VariantAnalysisMonitor } from "../../../remote-queries/variant-analysis-monitor";
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisFailureReason,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
} from "../../../remote-queries/gh-api/variant-analysis";
import {
  createFailedMockApiResponse,
  createMockApiResponse,
} from "../../factories/remote-queries/gh-api/variant-analysis-api-response";
import {
  VariantAnalysis,
  VariantAnalysisStatus,
} from "../../../remote-queries/shared/variant-analysis";
import { createMockScannedRepos } from "../../factories/remote-queries/gh-api/scanned-repositories";
import {
  processFailureReason,
  processScannedRepository,
  processUpdatedVariantAnalysis,
} from "../../../remote-queries/variant-analysis-processor";
import { Credentials } from "../../../authentication";
import { createMockVariantAnalysis } from "../../factories/remote-queries/shared/variant-analysis";
import { VariantAnalysisManager } from "../../../remote-queries/variant-analysis-manager";

describe("Variant Analysis Monitor", async function () {
  this.timeout(60000);

  let sandbox: sinon.SinonSandbox;
  let extension: CodeQLExtensionInterface | Record<string, never>;
  let mockGetVariantAnalysis: sinon.SinonStub;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisMonitor: VariantAnalysisMonitor;
  let shouldCancelMonitor: sinon.SinonStub;
  let variantAnalysis: VariantAnalysis;
  let variantAnalysisManager: VariantAnalysisManager;
  let mockGetDownloadResult: sinon.SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(config, "isVariantAnalysisLiveResultsEnabled").returns(false);
    shouldCancelMonitor = sinon.stub();

    cancellationTokenSource = new CancellationTokenSource();

    variantAnalysis = createMockVariantAnalysis({});

    try {
      extension = await extensions
        .getExtension<CodeQLExtensionInterface | Record<string, never>>(
          "GitHub.vscode-codeql",
        )!
        .activate();
      variantAnalysisMonitor = new VariantAnalysisMonitor(
        extension.ctx,
        shouldCancelMonitor,
      );
    } catch (e) {
      fail(e as Error);
    }

    variantAnalysisManager = extension.variantAnalysisManager;
    mockGetDownloadResult = sandbox.stub(
      variantAnalysisManager,
      "autoDownloadVariantAnalysisResult",
    );

    limitNumberOfAttemptsToMonitor();
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe("when credentials are invalid", async () => {
    beforeEach(async () => {
      sandbox.stub(Credentials, "initialize").resolves(undefined);
    });

    it("should return early if credentials are wrong", async () => {
      try {
        await variantAnalysisMonitor.monitorVariantAnalysis(
          variantAnalysis,
          cancellationTokenSource.token,
        );
      } catch (error: any) {
        expect(error.message).to.equal("Error authenticating with GitHub");
      }
    });
  });

  describe("when credentials are valid", async () => {
    beforeEach(async () => {
      const mockCredentials = {
        getOctokit: () =>
          Promise.resolve({
            request: mockGetVariantAnalysis,
          }),
      } as unknown as Credentials;
      sandbox.stub(Credentials, "initialize").resolves(mockCredentials);
    });

    it("should return early if variant analysis is cancelled", async () => {
      cancellationTokenSource.cancel();

      const result = await variantAnalysisMonitor.monitorVariantAnalysis(
        variantAnalysis,
        cancellationTokenSource.token,
      );

      expect(result).to.eql({ status: "Canceled" });
    });

    it("should return early if variant analysis should be cancelled", async () => {
      shouldCancelMonitor.resolves(true);

      const result = await variantAnalysisMonitor.monitorVariantAnalysis(
        variantAnalysis,
        cancellationTokenSource.token,
      );

      expect(result).to.eql({ status: "Canceled" });
    });

    describe("when the variant analysis fails", async () => {
      let mockFailedApiResponse: VariantAnalysisApiResponse;

      beforeEach(async function () {
        mockFailedApiResponse = createFailedMockApiResponse();
        mockGetVariantAnalysis = sandbox
          .stub(ghApiClient, "getVariantAnalysis")
          .resolves(mockFailedApiResponse);
      });

      it("should mark as failed locally and stop monitoring", async () => {
        const result = await variantAnalysisMonitor.monitorVariantAnalysis(
          variantAnalysis,
          cancellationTokenSource.token,
        );

        expect(mockGetVariantAnalysis.calledOnce).to.be.true;
        expect(result.status).to.eql("Completed");
        expect(result.variantAnalysis?.status).to.equal(
          VariantAnalysisStatus.Failed,
        );
        expect(result.variantAnalysis?.failureReason).to.equal(
          processFailureReason(
            mockFailedApiResponse.failure_reason as VariantAnalysisFailureReason,
          ),
        );
      });

      it("should emit `onVariantAnalysisChange`", async () => {
        const spy = sandbox.spy();
        variantAnalysisMonitor.onVariantAnalysisChange(spy);

        const result = await variantAnalysisMonitor.monitorVariantAnalysis(
          variantAnalysis,
          cancellationTokenSource.token,
        );

        expect(spy).to.have.been.calledWith(result.variantAnalysis);
      });
    });

    describe("when the variant analysis is in progress", async () => {
      let mockApiResponse: VariantAnalysisApiResponse;
      let scannedRepos: ApiVariantAnalysisScannedRepository[];
      let succeededRepos: ApiVariantAnalysisScannedRepository[];

      describe("when there are successfully scanned repos", async () => {
        beforeEach(async function () {
          scannedRepos = createMockScannedRepos([
            "pending",
            "pending",
            "in_progress",
            "in_progress",
            "succeeded",
            "succeeded",
            "succeeded",
          ]);
          mockApiResponse = createMockApiResponse("succeeded", scannedRepos);
          mockGetVariantAnalysis = sandbox
            .stub(ghApiClient, "getVariantAnalysis")
            .resolves(mockApiResponse);
          succeededRepos = scannedRepos.filter(
            (r) => r.analysis_status === "succeeded",
          );
        });

        it("should succeed and return a list of scanned repo ids", async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(result.status).to.equal("Completed");
          expect(result.scannedReposDownloaded).to.eql(
            succeededRepos.map((r) => r.repository.id),
          );
        });

        it("should trigger a download extension command for each repo", async () => {
          const succeededRepos = scannedRepos.filter(
            (r) => r.analysis_status === "succeeded",
          );
          const commandSpy = sandbox.spy(commands, "executeCommand");

          await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(commandSpy).to.have.callCount(succeededRepos.length);

          succeededRepos.forEach((succeededRepo, index) => {
            expect(commandSpy.getCall(index).args[0]).to.eq(
              "codeQL.autoDownloadVariantAnalysisResult",
            );
            expect(commandSpy.getCall(index).args[1]).to.deep.eq(
              processScannedRepository(succeededRepo),
            );
            expect(commandSpy.getCall(index).args[2]).to.deep.eq(
              processUpdatedVariantAnalysis(variantAnalysis, mockApiResponse),
            );
          });
        });

        it("should download all available results", async () => {
          await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(mockGetDownloadResult).to.have.callCount(
            succeededRepos.length,
          );

          succeededRepos.forEach((succeededRepo, index) => {
            expect(mockGetDownloadResult.getCall(index).args[0]).to.deep.eq(
              processScannedRepository(succeededRepo),
            );
            expect(mockGetDownloadResult.getCall(index).args[1]).to.deep.eq(
              processUpdatedVariantAnalysis(variantAnalysis, mockApiResponse),
            );
          });
        });
      });

      describe("when there are only in progress repos", async () => {
        let scannedRepos: ApiVariantAnalysisScannedRepository[];

        beforeEach(async function () {
          scannedRepos = createMockScannedRepos(["pending", "in_progress"]);
          mockApiResponse = createMockApiResponse("in_progress", scannedRepos);
          mockGetVariantAnalysis = sandbox
            .stub(ghApiClient, "getVariantAnalysis")
            .resolves(mockApiResponse);
        });

        it("should succeed and return an empty list of scanned repo ids", async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(result.status).to.equal("Completed");
          expect(result.scannedReposDownloaded).to.eql([]);
        });

        it("should not try to download any repos", async () => {
          await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(mockGetDownloadResult).to.not.have.been.called;
        });
      });

      describe("when there are no repos to scan", async () => {
        beforeEach(async function () {
          scannedRepos = [];
          mockApiResponse = createMockApiResponse("succeeded", scannedRepos);
          mockGetVariantAnalysis = sandbox
            .stub(ghApiClient, "getVariantAnalysis")
            .resolves(mockApiResponse);
        });

        it("should succeed and return an empty list of scanned repo ids", async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(result.status).to.equal("Completed");
          expect(result.scannedReposDownloaded).to.eql([]);
        });

        it("should not try to download any repos", async () => {
          await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(mockGetDownloadResult).to.not.have.been.called;
        });
      });
    });
  });

  function limitNumberOfAttemptsToMonitor() {
    VariantAnalysisMonitor.maxAttemptCount = 3;
    VariantAnalysisMonitor.sleepTime = 1;
  }
});
