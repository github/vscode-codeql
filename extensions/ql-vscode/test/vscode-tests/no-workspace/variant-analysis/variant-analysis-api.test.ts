import {
  ConfigurationTarget,
  EventEmitter,
  extensions,
  workspace,
} from "vscode";
import type { ConfigurationChangeEvent, Disposable, Extension } from "vscode";
import {
  getVariantAnalysisServerConfig,
  VariantAnalysisConfigListener,
} from "../../../../src/config";
import {
  cancelVariantAnalysis,
  canViewVariantAnalysisLogs,
  openServerVariantAnalysisLogs,
  withVariantAnalysisLogCapability,
  onDidChangeVariantAnalysisLogCapabilities,
  watchVariantAnalysisLogCapabilities,
  createGist,
  getVariantAnalysis,
  getVariantAnalysisRepo,
  getServerForVariantAnalysis,
  submitVariantAnalysis,
} from "../../../../src/variant-analysis/variant-analysis-api";
import { isVariantAnalysisEnabledForGitHubHost } from "../../../../src/variant-analysis/ghec-dr";
import { createMockSubmission } from "../../../factories/variant-analysis/shared/variant-analysis-submission";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import { mockedObject } from "../../utils/mocking.helpers";
import { testCredentialsWithStub } from "../../../factories/authentication";
import type { VariantAnalysisServerTokenProvider } from "../../../../src/variant-analysis/gh-api/variant-analysis-server-client";
import { extLogger } from "../../../../src/common/logging/vscode";
import { setImmediate } from "timers/promises";

const SERVER_URL = "https://mrva.example.com";
const PROVIDER_ID = "example.token-provider";

async function setSetting(
  name: string,
  value: string,
  target = ConfigurationTarget.Global,
) {
  await workspace
    .getConfiguration("codeQL.variantAnalysis")
    .update(name, value, target);
}

describe("variant analysis custom server", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let getVariantAnalysisServerToken: jest.Mock<
    Promise<string | undefined>,
    [string]
  >;
  let credentials: ReturnType<typeof testCredentialsWithStub>;
  let configurationChanged: EventEmitter<ConfigurationChangeEvent>;
  let watcher: Disposable;

  beforeEach(() => {
    configurationChanged = new EventEmitter<ConfigurationChangeEvent>();
    jest
      .spyOn(workspace, "onDidChangeConfiguration")
      .mockImplementation(configurationChanged.event);
    watcher = watchVariantAnalysisLogCapabilities();
    credentials = testCredentialsWithStub();
    fetchSpy = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async () => new Response(JSON.stringify({ id: 123 })),
      );
    getVariantAnalysisServerToken = jest.fn().mockResolvedValue("the-token");
    jest.spyOn(extensions, "getExtension").mockImplementation((id: string) =>
      id === PROVIDER_ID
        ? mockedObject<Extension<VariantAnalysisServerTokenProvider>>({
            isActive: true,
            exports: { getVariantAnalysisServerToken },
          })
        : undefined,
    );
  });

  afterEach(() => {
    watcher.dispose();
    configurationChanged.dispose();
  });

  function discoveryFinished(): Promise<void> {
    return new Promise((resolve) => {
      const subscription = onDidChangeVariantAnalysisLogCapabilities(() => {
        subscription.dispose();
        resolve();
      });
    });
  }

  describe("configuration", () => {
    it.each([`${SERVER_URL}/?environment=test`, `${SERVER_URL}/#fragment`])(
      "rejects endpoint modifiers: %s",
      async (url) => {
        await setSetting("serverUrl", url);
        expect(() => getVariantAnalysisServerConfig()).toThrow();
      },
    );

    it("preserves a base path", async () => {
      await setSetting("serverUrl", `${SERVER_URL}/api/`);
      expect(getVariantAnalysisServerConfig()?.url).toBe(`${SERVER_URL}/api`);
    });
    it("is not configured by default", () => {
      expect(getVariantAnalysisServerConfig()).toBeUndefined();
    });

    it("reads the server URL and token provider from user settings", async () => {
      await setSetting("serverUrl", `${SERVER_URL}/`);
      await setSetting("serverTokenProvider", PROVIDER_ID);

      expect(getVariantAnalysisServerConfig()).toEqual({
        url: SERVER_URL,
        tokenProviderExtensionId: PROVIDER_ID,
      });
      expect(isVariantAnalysisEnabledForGitHubHost()).toBe(true);
    });

    it("hides system-defined repository lists only in server mode", async () => {
      const config = new VariantAnalysisConfigListener();
      try {
        expect(config.showSystemDefinedRepositoryLists).toBe(true);
        await setSetting("serverUrl", SERVER_URL);
        expect(config.showSystemDefinedRepositoryLists).toBe(false);
        await setSetting("serverUrl", "");
        expect(config.showSystemDefinedRepositoryLists).toBe(true);
      } finally {
        config.dispose();
      }
    });

    it("ignores workspace settings", async () => {
      await setSetting("serverUrl", SERVER_URL, ConfigurationTarget.Workspace);
      await setSetting(
        "serverUrl",
        SERVER_URL,
        ConfigurationTarget.WorkspaceFolder,
      );

      expect(getVariantAnalysisServerConfig()).toBeUndefined();
    });

    it("ignores a workspace token provider", async () => {
      await setSetting("serverUrl", SERVER_URL);
      await setSetting(
        "serverTokenProvider",
        PROVIDER_ID,
        ConfigurationTarget.Workspace,
      );

      expect(getVariantAnalysisServerConfig()?.tokenProviderExtensionId).toBe(
        undefined,
      );
    });

    it.each(["http://mrva.example.com", "https://user:pw@mrva.example.com"])(
      "rejects %s",
      async (url) => {
        await setSetting("serverUrl", url);
        expect(() => getVariantAnalysisServerConfig()).toThrow();
      },
    );
  });

  describe("when not configured", () => {
    it("does not call the server", async () => {
      await expect(
        submitVariantAnalysis(credentials, createMockSubmission()),
      ).rejects.toThrow("no stub was provided");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("when configured", () => {
    beforeEach(async () => {
      await setSetting("serverUrl", SERVER_URL);
      await setSetting("serverTokenProvider", PROVIDER_ID);
    });

    it("hides server logs when the companion has no log hook", async () => {
      const run = { ...createMockVariantAnalysis({}), serverUrl: SERVER_URL };
      const finished = discoveryFinished();
      expect(canViewVariantAnalysisLogs(run)).toBe(false);
      await finished;
      expect(canViewVariantAnalysisLogs(run)).toBe(false);
      await expect(openServerVariantAnalysisLogs(run)).rejects.toThrow(
        "does not support viewing logs",
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each(["missing", "failed", "stalled"])(
      "preserves saved results when the log provider is %s",
      async (state) => {
        const run = { ...createMockVariantAnalysis({}), serverUrl: SERVER_URL };
        const log = jest.spyOn(extLogger, "log").mockResolvedValue(undefined);
        const lookup = jest.spyOn(extensions, "getExtension").mockReturnValue(
          state === "missing"
            ? undefined
            : mockedObject<Extension<VariantAnalysisServerTokenProvider>>({
                isActive: false,
                activate: () =>
                  state === "failed"
                    ? Promise.reject(new Error("Activation failed"))
                    : new Promise(() => {}),
              }),
        );
        if (state === "stalled") {
          jest.useFakeTimers();
        }
        try {
          const finished = discoveryFinished();
          const result = withVariantAnalysisLogCapability(run);
          expect(result).toEqual({ ...run, canViewLogs: false });
          for (let id = 0; id < 10; id++) {
            expect(canViewVariantAnalysisLogs({ ...run, id })).toBe(false);
          }
          expect(lookup).toHaveBeenCalledTimes(1);
          if (state === "stalled") {
            await jest.advanceTimersByTimeAsync(30_000);
            expect(jest.getTimerCount()).toBe(0);
          }
          await finished;
          expect(withVariantAnalysisLogCapability(run)).toEqual(result);
          expect(lookup).toHaveBeenCalledTimes(1);
          expect(log).toHaveBeenCalledWith(
            expect.stringContaining("Unable to discover variant analysis logs"),
          );
          expect(getVariantAnalysisServerToken).not.toHaveBeenCalled();
          expect(fetchSpy).not.toHaveBeenCalled();
          if (state !== "stalled") {
            await expect(openServerVariantAnalysisLogs(run)).rejects.toThrow();
          }
        } finally {
          if (state === "stalled") {
            jest.useRealTimers();
          }
        }
      },
    );

    it.each(["serverUrl", "serverTokenProvider"])(
      "invalidates discovery on %s changes and ignores stale completions",
      async (setting) => {
        let finishActivation!: (
          provider: VariantAnalysisServerTokenProvider,
        ) => void;
        const activate = jest.fn().mockImplementation(
          () =>
            new Promise<VariantAnalysisServerTokenProvider>((resolve) => {
              finishActivation = resolve;
            }),
        );
        jest.spyOn(extensions, "getExtension").mockReturnValue(
          mockedObject<Extension<VariantAnalysisServerTokenProvider>>({
            isActive: false,
            activate,
          }),
        );
        const run = { ...createMockVariantAnalysis({}), serverUrl: SERVER_URL };
        const changed = jest.fn();
        const subscription = onDidChangeVariantAnalysisLogCapabilities(changed);
        try {
          expect(canViewVariantAnalysisLogs(run)).toBe(false);
          const oldActivation = finishActivation;
          configurationChanged.fire({
            affectsConfiguration: (key) =>
              key === `codeQL.variantAnalysis.${setting}`,
          });
          expect(changed).toHaveBeenCalledTimes(1);
          expect(canViewVariantAnalysisLogs(run)).toBe(false);
          expect(activate).toHaveBeenCalledTimes(2);
          const finished = discoveryFinished();
          finishActivation({ getVariantAnalysisServerToken });
          await finished;
          expect(canViewVariantAnalysisLogs(run)).toBe(false);
          oldActivation({
            getVariantAnalysisServerToken,
            openVariantAnalysisLogs: jest.fn(),
          });
          // Drain the obsolete discovery's continuation without a real timer.
          await setImmediate();
          expect(canViewVariantAnalysisLogs(run)).toBe(false);
          expect(changed).toHaveBeenCalledTimes(2);
          expect(activate).toHaveBeenCalledTimes(2);
        } finally {
          subscription.dispose();
        }
      },
    );

    it("activates the companion and delegates log viewing without fetching a token", async () => {
      const openVariantAnalysisLogs = jest.fn().mockResolvedValue(undefined);
      const activate = jest.fn().mockResolvedValue({
        getVariantAnalysisServerToken,
        openVariantAnalysisLogs,
      });
      jest.spyOn(extensions, "getExtension").mockReturnValue(
        mockedObject<Extension<VariantAnalysisServerTokenProvider>>({
          isActive: false,
          activate,
        }),
      );
      const run = {
        ...createMockVariantAnalysis({}),
        serverUrl: SERVER_URL,
        actionsWorkflowRunId: undefined,
      };
      const finished = discoveryFinished();
      expect(canViewVariantAnalysisLogs(run)).toBe(false);
      expect(canViewVariantAnalysisLogs({ ...run, id: run.id + 1 })).toBe(
        false,
      );
      await finished;
      expect(canViewVariantAnalysisLogs(run)).toBe(true);
      expect(activate).toHaveBeenCalledTimes(1);
      await openServerVariantAnalysisLogs(run);
      expect(activate).toHaveBeenCalled();
      expect(openVariantAnalysisLogs).toHaveBeenCalledWith(SERVER_URL, run.id);
      expect(getVariantAnalysisServerToken).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      openVariantAnalysisLogs.mockRejectedValue(new Error("Cannot open logs"));
      await expect(openServerVariantAnalysisLogs(run)).rejects.toThrow(
        "Cannot open logs",
      );
      await setSetting("serverUrl", "https://other.example.com");
      expect(canViewVariantAnalysisLogs(run)).toBe(false);
      openVariantAnalysisLogs.mockClear();
      await expect(openServerVariantAnalysisLogs(run)).rejects.toThrow(
        "different server",
      );
      expect(openVariantAnalysisLogs).not.toHaveBeenCalled();
    });

    it.each(["activation", "token"])(
      "bounds a stalled provider %s",
      async (stage) => {
        jest.useFakeTimers();
        try {
          if (stage === "activation") {
            jest.spyOn(extensions, "getExtension").mockReturnValue(
              mockedObject<Extension<VariantAnalysisServerTokenProvider>>({
                isActive: false,
                activate: () => new Promise(() => {}),
              }),
            );
          } else {
            getVariantAnalysisServerToken.mockReturnValue(
              new Promise(() => {}),
            );
          }
          const request = getVariantAnalysis(credentials, 0, 5, SERVER_URL);
          const rejected = expect(request).rejects.toThrow(
            /did not respond within 30 seconds/,
          );
          await jest.advanceTimersByTimeAsync(30_000);
          await rejected;
          expect(fetchSpy).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(0);
        } finally {
          jest.useRealTimers();
        }
      },
    );

    it.each([401, 403])(
      "identifies the provider on HTTP %s without retrying",
      async (status) => {
        fetchSpy.mockResolvedValue(new Response(null, { status }));
        await expect(
          getVariantAnalysis(credentials, 0, 5, SERVER_URL),
        ).rejects.toThrow(
          `Re-authenticate using the token provider '${PROVIDER_ID}'`,
        );
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(getVariantAnalysisServerToken).toHaveBeenCalledTimes(1);
      },
    );

    it("submits to the server with the provided token", async () => {
      const submission = createMockSubmission();
      submission.controllerRepoId = 0;
      submission.serverUrl = SERVER_URL;

      const result = await submitVariantAnalysis(credentials, submission);

      expect(result).toEqual({ id: 123 });
      expect(getVariantAnalysisServerToken).toHaveBeenCalledWith(SERVER_URL);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        `${SERVER_URL}/repositories/0/code-scanning/codeql/variant-analyses`,
      );
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("error");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer the-token",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(init?.body as string)).toMatchObject({
        action_repo_ref: submission.actionRepoRef,
        language: submission.language,
        query_pack: submission.pack,
      });
    });

    it("gets a variant analysis and a repo task", async () => {
      await getVariantAnalysis(credentials, 0, 5, SERVER_URL);
      await getVariantAnalysisRepo(credentials, 0, 5, 7, SERVER_URL);

      expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
        `${SERVER_URL}/repositories/0/code-scanning/codeql/variant-analyses/5`,
        `${SERVER_URL}/repositories/0/code-scanning/codeql/variant-analyses/5/repositories/7`,
      ]);
    });

    it("cancels on the server", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 202 }));
      const variantAnalysis = createMockVariantAnalysis({});
      variantAnalysis.serverUrl = SERVER_URL;
      variantAnalysis.actionsWorkflowRunId = undefined;

      await cancelVariantAnalysis(credentials, variantAnalysis);

      expect(fetchSpy).toHaveBeenCalledWith(
        `${SERVER_URL}/repositories/${variantAnalysis.controllerRepo.id}/code-scanning/codeql/variant-analyses/${variantAnalysis.id}/cancel`,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it.each(["<html>not JSON</html>", ""])(
      "rejects a malformed successful response: %s",
      async (body) => {
        fetchSpy.mockResolvedValue(new Response(body));
        await expect(
          getVariantAnalysis(credentials, 0, 5, SERVER_URL),
        ).rejects.toThrow(/invalid JSON|empty response/);
      },
    );

    it("does not export to a gist", async () => {
      await expect(createGist(credentials, "", {}, SERVER_URL)).rejects.toThrow(
        /not supported/,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fails without a token, without sending a request", async () => {
      getVariantAnalysisServerToken.mockResolvedValue(undefined);

      await expect(
        getVariantAnalysis(credentials, 0, 5, SERVER_URL),
      ).rejects.toThrow(/did not return a variant analysis server token/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fails if no token provider is configured", async () => {
      await setSetting("serverTokenProvider", "");

      await expect(
        getVariantAnalysis(credentials, 0, 5, SERVER_URL),
      ).rejects.toThrow(/No token provider/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fails if the token provider is not installed", async () => {
      await setSetting("serverTokenProvider", "other.extension");

      await expect(
        getVariantAnalysis(credentials, 0, 5, SERVER_URL),
      ).rejects.toThrow(/not installed/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("reports server errors with the status and message", async () => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ message: "Token expired" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      await expect(
        getVariantAnalysis(credentials, 0, 5, SERVER_URL),
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringContaining("401 Unauthorized: Token expired"),
      });
    });

    it("preserves HTTP error status when the response body is empty", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
      await expect(
        getVariantAnalysis(credentials, 0, 5, SERVER_URL),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("rejects custom runs after removing the setting", async () => {
      await setSetting("serverUrl", "");
      expect(() => getServerForVariantAnalysis(SERVER_URL)).toThrow(
        /different server/,
      );
      await expect(createGist(credentials, "", {}, SERVER_URL)).rejects.toThrow(
        /not supported/,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects legacy GitHub runs when a custom server is configured", async () => {
      await setSetting("serverUrl", SERVER_URL);
      await expect(getVariantAnalysis(credentials, 0, 5)).rejects.toThrow(
        /different server/,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("rejects status, results, and cancellation after changing servers", async () => {
      await setSetting("serverUrl", "https://other.example.com");
      const run = createMockVariantAnalysis({});
      run.serverUrl = SERVER_URL;
      await expect(
        getVariantAnalysis(credentials, 0, 5, SERVER_URL),
      ).rejects.toThrow(/different server/);
      await expect(
        getVariantAnalysisRepo(credentials, 0, 5, 7, SERVER_URL),
      ).rejects.toThrow(/different server/);
      await expect(cancelVariantAnalysis(credentials, run)).rejects.toThrow(
        /different server/,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
