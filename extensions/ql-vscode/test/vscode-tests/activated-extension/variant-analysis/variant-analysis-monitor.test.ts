import * as ghApiClient from "../../../../src/variant-analysis/gh-api/gh-api-client";
import { RequestError } from "@octokit/request-error";
import { VariantAnalysisMonitor } from "../../../../src/variant-analysis/variant-analysis-monitor";
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisFailureReason,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
} from "../../../../src/variant-analysis/gh-api/variant-analysis";
import {
  createFailedMockApiResponse,
  createMockApiResponse,
} from "../../../factories/variant-analysis/gh-api/variant-analysis-api-response";
import {
  VariantAnalysis,
  VariantAnalysisStatus,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockScannedRepos } from "../../../factories/variant-analysis/gh-api/scanned-repositories";
import {
  processFailureReason,
  processScannedRepository,
  processUpdatedVariantAnalysis,
} from "../../../../src/variant-analysis/variant-analysis-processor";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import { createMockApp } from "../../../__mocks__/appMock";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";
import * as helpers from "../../../../src/helpers";

jest.setTimeout(60_000);

describe("Variant Analysis Monitor", () => {
  let mockGetVariantAnalysis: jest.SpiedFunction<
    typeof ghApiClient.getVariantAnalysis
  >;
  let variantAnalysisMonitor: VariantAnalysisMonitor;
  let shouldCancelMonitor: jest.Mock<Promise<boolean>, [number]>;
  let variantAnalysis: VariantAnalysis;

  const onVariantAnalysisChangeSpy = jest.fn();
  const mockEecuteCommand = jest.fn();

  beforeEach(async () => {
    variantAnalysis = createMockVariantAnalysis({});

    shouldCancelMonitor = jest.fn();

    variantAnalysisMonitor = new VariantAnalysisMonitor(
      createMockApp({
        commands: createMockCommandManager({
          executeCommand: mockEecuteCommand,
        }),
      }),
      shouldCancelMonitor,
    );
    variantAnalysisMonitor.onVariantAnalysisChange(onVariantAnalysisChangeSpy);

    mockGetVariantAnalysis = jest
      .spyOn(ghApiClient, "getVariantAnalysis")
      .mockRejectedValue(new Error("Not mocked"));

    limitNumberOfAttemptsToMonitor();
  });

  it("should return early if variant analysis should be cancelled", async () => {
    shouldCancelMonitor.mockResolvedValue(true);

    await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);

    expect(onVariantAnalysisChangeSpy).not.toHaveBeenCalled();
  });

  describe("when the variant analysis fails", () => {
    let mockFailedApiResponse: VariantAnalysisApiResponse;

    beforeEach(async () => {
      mockFailedApiResponse = createFailedMockApiResponse();
      mockGetVariantAnalysis.mockResolvedValue(mockFailedApiResponse);
    });

    it("should mark as failed and stop monitoring", async () => {
      await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);

      expect(mockGetVariantAnalysis).toHaveBeenCalledTimes(1);

      expect(onVariantAnalysisChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: VariantAnalysisStatus.Failed,
          failureReason: processFailureReason(
            mockFailedApiResponse.failure_reason as VariantAnalysisFailureReason,
          ),
        }),
      );
    });
  });

  describe("when the variant analysis is in progress", () => {
    let mockApiResponse: VariantAnalysisApiResponse;
    let scannedRepos: ApiVariantAnalysisScannedRepository[];

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
      });

      it("should trigger a download extension command for each repo", async () => {
        const succeededRepos = scannedRepos.filter(
          (r) => r.analysis_status === "succeeded",
        );
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);

        expect(mockEecuteCommand).toBeCalledTimes(succeededRepos.length);

        succeededRepos.forEach((succeededRepo, index) => {
          expect(mockEecuteCommand).toHaveBeenNthCalledWith(
            index + 1,
            "codeQL.autoDownloadVariantAnalysisResult",
            processScannedRepository(succeededRepo),
            processUpdatedVariantAnalysis(variantAnalysis, mockApiResponse),
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

      it("should succeed and not download any repos via a command", async () => {
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);

        expect(mockEecuteCommand).not.toHaveBeenCalled();
      });
    });

    describe("when the responses change", () => {
      let scannedRepos: ApiVariantAnalysisScannedRepository[];

      beforeEach(async () => {
        scannedRepos = createMockScannedRepos([
          "pending",
          "in_progress",
          "in_progress",
          "in_progress",
          "pending",
          "pending",
        ]);
        mockApiResponse = createMockApiResponse("in_progress", scannedRepos);
        mockGetVariantAnalysis.mockResolvedValueOnce(mockApiResponse);

        let nextApiResponse = {
          ...mockApiResponse,
          scanned_repositories: [...scannedRepos.map((r) => ({ ...r }))],
        };
        nextApiResponse.scanned_repositories[0].analysis_status = "succeeded";
        nextApiResponse.scanned_repositories[1].analysis_status = "succeeded";
        mockGetVariantAnalysis.mockResolvedValueOnce(nextApiResponse);

        nextApiResponse = {
          ...mockApiResponse,
          scanned_repositories: [
            ...nextApiResponse.scanned_repositories.map((r) => ({ ...r })),
          ],
        };
        nextApiResponse.scanned_repositories[2].analysis_status = "succeeded";
        nextApiResponse.scanned_repositories[5].analysis_status = "succeeded";
        mockGetVariantAnalysis.mockResolvedValueOnce(nextApiResponse);

        nextApiResponse = {
          ...mockApiResponse,
          scanned_repositories: [
            ...nextApiResponse.scanned_repositories.map((r) => ({ ...r })),
          ],
        };
        nextApiResponse.scanned_repositories[3].analysis_status = "succeeded";
        nextApiResponse.scanned_repositories[4].analysis_status = "failed";
        mockGetVariantAnalysis.mockResolvedValueOnce(nextApiResponse);
      });

      it("should trigger a download extension command for each repo", async () => {
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);

        expect(mockGetVariantAnalysis).toBeCalledTimes(4);
        expect(mockEecuteCommand).toBeCalledTimes(5);
      });
    });

    describe("when some responses fail", () => {
      let showAndLogWarningMessageSpy: jest.SpiedFunction<
        typeof helpers.showAndLogWarningMessage
      >;

      let scannedRepos: ApiVariantAnalysisScannedRepository[];

      beforeEach(async () => {
        showAndLogWarningMessageSpy = jest
          .spyOn(helpers, "showAndLogWarningMessage")
          .mockResolvedValue(undefined);

        scannedRepos = createMockScannedRepos([
          "pending",
          "in_progress",
          "in_progress",
          "in_progress",
          "pending",
          "pending",
        ]);
        mockApiResponse = createMockApiResponse("in_progress", scannedRepos);
        mockGetVariantAnalysis.mockResolvedValueOnce(mockApiResponse);

        mockGetVariantAnalysis.mockRejectedValueOnce(
          new Error("No internet connection"),
        );
        mockGetVariantAnalysis.mockRejectedValueOnce(
          new Error("No internet connection"),
        );
        mockGetVariantAnalysis.mockRejectedValueOnce(
          new Error("My different error"),
        );

        let nextApiResponse = {
          ...mockApiResponse,
          scanned_repositories: [...scannedRepos.map((r) => ({ ...r }))],
        };
        nextApiResponse.scanned_repositories[0].analysis_status = "succeeded";
        nextApiResponse.scanned_repositories[1].analysis_status = "succeeded";

        mockGetVariantAnalysis.mockResolvedValueOnce(nextApiResponse);

        mockGetVariantAnalysis.mockRejectedValueOnce(
          new Error("My different error"),
        );
        mockGetVariantAnalysis.mockRejectedValueOnce(
          new Error("My different error"),
        );
        mockGetVariantAnalysis.mockRejectedValueOnce(
          new Error("Another different error"),
        );

        nextApiResponse = {
          ...mockApiResponse,
          scanned_repositories: [...scannedRepos.map((r) => ({ ...r }))],
        };
        nextApiResponse.scanned_repositories[2].analysis_status = "succeeded";
        nextApiResponse.scanned_repositories[3].analysis_status = "succeeded";
        nextApiResponse.scanned_repositories[4].analysis_status = "failed";
        nextApiResponse.scanned_repositories[5].analysis_status = "succeeded";
        nextApiResponse.status = "succeeded";
        mockGetVariantAnalysis.mockResolvedValueOnce(nextApiResponse);
      });

      it("should only trigger the warning once per error", async () => {
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);

        expect(showAndLogWarningMessageSpy).toBeCalledTimes(4);
        expect(showAndLogWarningMessageSpy).toHaveBeenNthCalledWith(
          1,
          expect.stringMatching(/No internet connection/),
        );
        expect(showAndLogWarningMessageSpy).toHaveBeenNthCalledWith(
          2,
          expect.stringMatching(/My different error/),
        );
        expect(showAndLogWarningMessageSpy).toHaveBeenNthCalledWith(
          3,
          expect.stringMatching(/My different error/),
        );
        expect(showAndLogWarningMessageSpy).toHaveBeenNthCalledWith(
          4,
          expect.stringMatching(/Another different error/),
        );
      });
    });

    describe("when there are no repos to scan", () => {
      beforeEach(async () => {
        scannedRepos = [];
        mockApiResponse = createMockApiResponse("succeeded", scannedRepos);
        mockGetVariantAnalysis.mockResolvedValue(mockApiResponse);
      });

      it("should not try to download any repos", async () => {
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);

        expect(mockEecuteCommand).not.toBeCalled();
      });
    });

    describe("when a 404 is returned", () => {
      let showAndLogWarningMessageSpy: jest.SpiedFunction<
        typeof helpers.showAndLogWarningMessage
      >;

      beforeEach(async () => {
        showAndLogWarningMessageSpy = jest
          .spyOn(helpers, "showAndLogWarningMessage")
          .mockResolvedValue(undefined);

        const scannedRepos = createMockScannedRepos([
          "pending",
          "in_progress",
          "in_progress",
          "in_progress",
          "pending",
          "pending",
        ]);
        mockApiResponse = createMockApiResponse("in_progress", scannedRepos);
        mockGetVariantAnalysis.mockResolvedValueOnce(mockApiResponse);

        mockGetVariantAnalysis.mockRejectedValueOnce(
          new RequestError("Not Found", 404, {
            request: {
              method: "GET",
              url: "",
              headers: {},
            },
            response: {
              status: 404,
              headers: {},
              url: "",
              data: {},
            },
          }),
        );
      });

      it("should stop requesting the variant analysis", async () => {
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);

        expect(mockGetVariantAnalysis).toHaveBeenCalledTimes(2);
        expect(showAndLogWarningMessageSpy).toHaveBeenCalledTimes(1);
        expect(showAndLogWarningMessageSpy).toHaveBeenCalledWith(
          expect.stringMatching(/not found/i),
        );
      });
    });
  });

  function limitNumberOfAttemptsToMonitor() {
    VariantAnalysisMonitor.maxAttemptCount = 3;
    VariantAnalysisMonitor.sleepTime = 1;
  }
});
