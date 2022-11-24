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

jest.setTimeout(60_000);

describe("Variant Analysis Monitor", () => {
  let extension: CodeQLExtensionInterface | Record<string, never>;
  let mockGetVariantAnalysis: jest.SpiedFunction<
    typeof ghApiClient.getVariantAnalysis
  >;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisMonitor: VariantAnalysisMonitor;
  let variantAnalysis: VariantAnalysis;
  let variantAnalysisManager: VariantAnalysisManager;
  let mockGetDownloadResult: jest.SpiedFunction<
    typeof variantAnalysisManager.autoDownloadVariantAnalysisResult
  >;

  beforeEach(async () => {
    jest
      .spyOn(config, "isVariantAnalysisLiveResultsEnabled")
      .mockReturnValue(false);

    cancellationTokenSource = new CancellationTokenSource();

    variantAnalysis = createMockVariantAnalysis({});

    extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
    variantAnalysisMonitor = new VariantAnalysisMonitor(extension.ctx);

    variantAnalysisManager = extension.variantAnalysisManager;
    mockGetDownloadResult = jest
      .spyOn(variantAnalysisManager, "autoDownloadVariantAnalysisResult")
      .mockResolvedValue(undefined);

    mockGetVariantAnalysis = jest
      .spyOn(ghApiClient, "getVariantAnalysis")
      .mockRejectedValue(new Error("Not mocked"));

    limitNumberOfAttemptsToMonitor();
  });

  describe("when credentials are invalid", () => {
    beforeEach(async () => {
      jest
        .spyOn(Credentials, "initialize")
        .mockResolvedValue(undefined as unknown as Credentials);
    });

    it("should return early if credentials are wrong", async () => {
      try {
        await variantAnalysisMonitor.monitorVariantAnalysis(
          variantAnalysis,
          cancellationTokenSource.token,
        );
      } catch (error: any) {
        expect(error.message).toBe("Error authenticating with GitHub");
      }
    });
  });

  describe("when credentials are valid", () => {
    beforeEach(async () => {
      const mockCredentials = {
        getOctokit: () =>
          Promise.resolve({
            request: jest.fn(),
          }),
      } as unknown as Credentials;
      jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);
    });

    it("should return early if variant analysis is cancelled", async () => {
      cancellationTokenSource.cancel();

      const result = await variantAnalysisMonitor.monitorVariantAnalysis(
        variantAnalysis,
        cancellationTokenSource.token,
      );

      expect(result).toEqual({ status: "Canceled" });
    });

    describe("when the variant analysis fails", () => {
      let mockFailedApiResponse: VariantAnalysisApiResponse;

      beforeEach(async () => {
        mockFailedApiResponse = createFailedMockApiResponse();
        mockGetVariantAnalysis.mockResolvedValue(mockFailedApiResponse);
      });

      it("should mark as failed locally and stop monitoring", async () => {
        const result = await variantAnalysisMonitor.monitorVariantAnalysis(
          variantAnalysis,
          cancellationTokenSource.token,
        );

        expect(mockGetVariantAnalysis).toHaveBeenCalledTimes(1);
        expect(result.status).toEqual("Completed");
        expect(result.variantAnalysis?.status).toBe(
          VariantAnalysisStatus.Failed,
        );
        expect(result.variantAnalysis?.failureReason).toBe(
          processFailureReason(
            mockFailedApiResponse.failure_reason as VariantAnalysisFailureReason,
          ),
        );
      });

      it("should emit `onVariantAnalysisChange`", async () => {
        const spy = jest.fn();
        variantAnalysisMonitor.onVariantAnalysisChange(spy);

        const result = await variantAnalysisMonitor.monitorVariantAnalysis(
          variantAnalysis,
          cancellationTokenSource.token,
        );

        expect(spy).toBeCalledWith(result.variantAnalysis);
      });
    });

    describe("when the variant analysis is in progress", () => {
      let mockApiResponse: VariantAnalysisApiResponse;
      let scannedRepos: ApiVariantAnalysisScannedRepository[];
      let succeededRepos: ApiVariantAnalysisScannedRepository[];

      describe("when there are successfully scanned repos", () => {
        beforeEach(async () => {
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
          mockGetVariantAnalysis.mockResolvedValue(mockApiResponse);
          succeededRepos = scannedRepos.filter(
            (r) => r.analysis_status === "succeeded",
          );
        });

        it("should succeed and return a list of scanned repo ids", async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(result.status).toBe("Completed");
          expect(result.scannedReposDownloaded).toEqual(
            succeededRepos.map((r) => r.repository.id),
          );
        });

        it("should trigger a download extension command for each repo", async () => {
          const succeededRepos = scannedRepos.filter(
            (r) => r.analysis_status === "succeeded",
          );
          const commandSpy = jest
            .spyOn(commands, "executeCommand")
            .mockResolvedValue(undefined);

          await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(commandSpy).toBeCalledTimes(succeededRepos.length);

          succeededRepos.forEach((succeededRepo, index) => {
            expect(commandSpy).toHaveBeenNthCalledWith(
              index + 1,
              "codeQL.autoDownloadVariantAnalysisResult",
              processScannedRepository(succeededRepo),
              processUpdatedVariantAnalysis(variantAnalysis, mockApiResponse),
            );
          });
        });

        it("should download all available results", async () => {
          await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(mockGetDownloadResult).toBeCalledTimes(succeededRepos.length);

          succeededRepos.forEach((succeededRepo, index) => {
            expect(mockGetDownloadResult).toHaveBeenNthCalledWith(
              index + 1,
              processScannedRepository(succeededRepo),
              processUpdatedVariantAnalysis(variantAnalysis, mockApiResponse),
              undefined,
            );
          });
        });
      });

      describe("when there are only in progress repos", () => {
        let scannedRepos: ApiVariantAnalysisScannedRepository[];

        beforeEach(async () => {
          scannedRepos = createMockScannedRepos(["pending", "in_progress"]);
          mockApiResponse = createMockApiResponse("in_progress", scannedRepos);
          mockGetVariantAnalysis.mockResolvedValue(mockApiResponse);
        });

        it("should succeed and return an empty list of scanned repo ids", async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(result.status).toBe("Completed");
          expect(result.scannedReposDownloaded).toEqual([]);
        });

        it("should not try to download any repos", async () => {
          await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(mockGetDownloadResult).not.toBeCalled();
        });
      });

      describe("when there are no repos to scan", () => {
        beforeEach(async () => {
          scannedRepos = [];
          mockApiResponse = createMockApiResponse("succeeded", scannedRepos);
          mockGetVariantAnalysis.mockResolvedValue(mockApiResponse);
        });

        it("should succeed and return an empty list of scanned repo ids", async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(result.status).toBe("Completed");
          expect(result.scannedReposDownloaded).toEqual([]);
        });

        it("should not try to download any repos", async () => {
          await variantAnalysisMonitor.monitorVariantAnalysis(
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(mockGetDownloadResult).not.toBeCalled();
        });
      });
    });
  });

  function limitNumberOfAttemptsToMonitor() {
    VariantAnalysisMonitor.maxAttemptCount = 3;
    VariantAnalysisMonitor.sleepTime = 1;
  }
});
