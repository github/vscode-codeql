import {
  ConfigurationTarget,
  EventEmitter,
  extensions,
  window,
  workspace,
} from "vscode";
import type { ConfigurationChangeEvent, Disposable, Extension } from "vscode";
import { setImmediate } from "timers/promises";
import type { AppCommandManager } from "../../../../src/common/commands";
import { extLogger } from "../../../../src/common/logging/vscode";
import {
  getVariantAnalysisServerConfig,
  isVariantAnalysisServerConfigured,
  VariantAnalysisConfigListener,
} from "../../../../src/config";
import { exportVariantAnalysisResults } from "../../../../src/variant-analysis/export-results";
import type { VariantAnalysisServerTokenProvider } from "../../../../src/variant-analysis/gh-api/variant-analysis-server-client";
import { requestVariantAnalysisServer } from "../../../../src/variant-analysis/gh-api/variant-analysis-server-client";
import {
  cancelVariantAnalysis,
  canViewServerVariantAnalysisLogs,
  getVariantAnalysis,
  getVariantAnalysisRepo,
  onDidChangeVariantAnalysisLogCapabilities,
  openServerVariantAnalysisLogs,
  submitVariantAnalysis,
  watchVariantAnalysisLogCapabilities,
  withVariantAnalysisLogCapability,
} from "../../../../src/variant-analysis/variant-analysis-api";
import type { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { testCredentialsWithStub } from "../../../factories/authentication";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import { createMockSubmission } from "../../../factories/variant-analysis/shared/variant-analysis-submission";
import type { DeepPartial } from "../../utils/mocking.helpers";
import { mockedObject } from "../../utils/mocking.helpers";

const SERVER_URL = "https://mrva.example.com";
const PROVIDER_ID = "example.token-provider";

async function setSetting(
  name: string,
  value: unknown,
  target = ConfigurationTarget.Global,
) {
  await workspace
    .getConfiguration("codeQL.variantAnalysis")
    .update(name, value, target);
}

async function configureServer() {
  await setSetting("serverUrl", SERVER_URL);
  await setSetting("serverTokenProvider", PROVIDER_ID);
}

function mockProvider(
  extension: DeepPartial<Extension<VariantAnalysisServerTokenProvider>>,
) {
  return jest
    .spyOn(extensions, "getExtension")
    .mockReturnValue(
      mockedObject<Extension<VariantAnalysisServerTokenProvider>>(extension),
    );
}

let fetchSpy: jest.SpiedFunction<typeof fetch>;
let getVariantAnalysisServerToken: jest.Mock<
  Promise<string | undefined>,
  [string]
>;

beforeEach(() => {
  fetchSpy = jest
    .spyOn(global, "fetch")
    .mockImplementation(async () => new Response(JSON.stringify({ id: 123 })));
  getVariantAnalysisServerToken = jest.fn().mockResolvedValue("the-token");
  mockProvider({ isActive: true, exports: { getVariantAnalysisServerToken } });
});

describe("exporting custom-server results", () => {
  it.each([undefined, SERVER_URL])(
    "only offers a gist for GitHub runs (server: %s)",
    async (serverUrl) => {
      const showQuickPick = jest
        .spyOn(window, "showQuickPick")
        .mockResolvedValue(undefined);
      const run = { ...createMockVariantAnalysis({}), serverUrl };

      await expect(
        exportVariantAnalysisResults(
          mockedObject<VariantAnalysisManager>({
            tryGetVariantAnalysis: () => run,
            getRepoStates: () => [],
          }),
          run.id,
          undefined,
          mockedObject<AppCommandManager>({}),
          testCredentialsWithStub(),
        ),
      ).rejects.toThrow("No export format selected");

      const [items] = showQuickPick.mock.calls[0] as [Array<{ label: string }>];
      expect(items.some((item) => item.label.includes("Gist"))).toBe(
        !serverUrl,
      );
    },
  );
});

describe("variant analysis server settings", () => {
  it.each([undefined, " "])(
    "is not configured when the URL is %p",
    async (url) => {
      await setSetting("serverUrl", url);
      expect(getVariantAnalysisServerConfig()).toBeUndefined();
      expect(isVariantAnalysisServerConfigured()).toBe(false);
    },
  );

  it("reads the server from user settings, keeping a base path", async () => {
    await setSetting("serverUrl", `${SERVER_URL}/api/`);
    await setSetting("serverTokenProvider", PROVIDER_ID);
    expect(getVariantAnalysisServerConfig()).toEqual({
      url: `${SERVER_URL}/api`,
      tokenProviderExtensionId: PROVIDER_ID,
    });
  });

  it("ignores workspace settings", async () => {
    for (const target of [
      ConfigurationTarget.Workspace,
      ConfigurationTarget.WorkspaceFolder,
    ]) {
      await setSetting("serverUrl", SERVER_URL, target);
      await setSetting("serverTokenProvider", PROVIDER_ID, target);
    }
    expect(isVariantAnalysisServerConfigured()).toBe(false);

    await setSetting("serverUrl", SERVER_URL);
    expect(getVariantAnalysisServerConfig()).toEqual({
      url: SERVER_URL,
      tokenProviderExtensionId: undefined,
    });
  });

  it.each([
    "http://mrva.example.com",
    "https://user:pw@mrva.example.com",
    `${SERVER_URL}/?environment=test`,
    `${SERVER_URL}/#fragment`,
    `${SERVER_URL}/?`,
    `${SERVER_URL}/#`,
    "not a URL",
  ])("rejects %p but still counts it as configured", async (url) => {
    await setSetting("serverUrl", url);
    expect(() => getVariantAnalysisServerConfig()).toThrow();
    expect(isVariantAnalysisServerConfigured()).toBe(true);
  });

  it.each([false, 0, {}, null])(
    "rejects a non-string URL (%p)",
    async (url) => {
      await setSetting("serverUrl", url);
      expect(() => getVariantAnalysisServerConfig()).toThrow(
        "codeQL.variantAnalysis.serverUrl must be a string.",
      );
      expect(isVariantAnalysisServerConfigured()).toBe(true);
    },
  );
});

describe("variant analysis server client", () => {
  const server = { url: SERVER_URL, tokenProviderExtensionId: PROVIDER_ID };

  it("sends JSON with the provider's token and refuses redirects", async () => {
    await expect(
      requestVariantAnalysisServer(server, "POST", "/analyses", {
        language: "java",
      }),
    ).resolves.toEqual({ id: 123 });

    expect(getVariantAnalysisServerToken).toHaveBeenCalledWith(SERVER_URL);
    expect(fetchSpy).toHaveBeenCalledWith(`${SERVER_URL}/analyses`, {
      redirect: "error",
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer the-token",
        "Content-Type": "application/json",
      },
      body: '{"language":"java"}',
    });
  });

  it("fails without a usable token, without sending a request", async () => {
    const request = (tokenProviderExtensionId = PROVIDER_ID) =>
      requestVariantAnalysisServer(
        { ...server, tokenProviderExtensionId },
        "GET",
        "/",
      );

    await expect(request("")).rejects.toThrow(/No token provider/);
    getVariantAnalysisServerToken.mockResolvedValue(undefined);
    await expect(request()).rejects.toThrow(/did not return .* token/);
    mockProvider({ isActive: true, exports: {} });
    await expect(request()).rejects.toThrow(/does not provide .* token/);
    jest.spyOn(extensions, "getExtension").mockReturnValue(undefined);
    await expect(request()).rejects.toThrow(/not installed/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([" ", "\n"])(
    "rejects a whitespace-only token (%p) before fetching",
    async (token) => {
      getVariantAnalysisServerToken.mockResolvedValue(token);
      fetchSpy.mockRejectedValueOnce(new Error("Unexpected fetch"));

      await expect(
        requestVariantAnalysisServer(server, "GET", "/"),
      ).rejects.toThrow("did not return a variant analysis server token");
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each(["activation", "token"])(
    "gives up on a stalled provider %s after 30 seconds",
    async (stage) => {
      jest.useFakeTimers();
      try {
        if (stage === "activation") {
          mockProvider({
            isActive: false,
            activate: () => new Promise(() => {}),
          });
        } else {
          getVariantAnalysisServerToken.mockReturnValue(new Promise(() => {}));
        }
        const rejected = expect(
          requestVariantAnalysisServer(server, "GET", "/"),
        ).rejects.toThrow(/did not respond within 30 seconds/);
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
    "asks to re-authenticate on HTTP %s without retrying",
    async (status) => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ message: "Token expired" }), {
          status,
          statusText: "Denied",
        }),
      );
      await expect(
        requestVariantAnalysisServer(server, "GET", "/"),
      ).rejects.toMatchObject({
        status,
        message: expect.stringContaining(
          `${status} Denied: Token expired Re-authenticate using the token provider '${PROVIDER_ID}'`,
        ),
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["<html>not JSON</html>", ""])(
    "rejects a malformed successful response: %p",
    async (body) => {
      fetchSpy.mockResolvedValue(new Response(body));
      await expect(
        requestVariantAnalysisServer(server, "GET", "/"),
      ).rejects.toThrow(/invalid JSON|empty response/);
    },
  );
});

describe("opening server logs", () => {
  let run: ReturnType<typeof createMockVariantAnalysis>;
  let openVariantAnalysisLogs: jest.Mock;

  beforeEach(async () => {
    await configureServer();
    run = { ...createMockVariantAnalysis({}), serverUrl: SERVER_URL };
    openVariantAnalysisLogs = jest.fn().mockResolvedValue(undefined);
    mockProvider({
      isActive: false,
      activate: jest.fn().mockResolvedValue({
        getVariantAnalysisServerToken,
        openVariantAnalysisLogs,
      }),
    });
  });

  it("activates the companion and delegates without requesting a token", async () => {
    run.serverRunId = 5;
    run.id = -1;
    await openServerVariantAnalysisLogs(run);
    expect(openVariantAnalysisLogs).toHaveBeenCalledWith(SERVER_URL, 5);
    expect(getVariantAnalysisServerToken).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    openVariantAnalysisLogs.mockRejectedValue(new Error("Cannot open logs"));
    await expect(openServerVariantAnalysisLogs(run)).rejects.toThrow(
      "Cannot open logs",
    );
  });

  it("refuses runs from another server", async () => {
    await setSetting("serverUrl", "https://other.example.com");
    await expect(openServerVariantAnalysisLogs(run)).rejects.toThrow(
      "different server",
    );
    expect(openVariantAnalysisLogs).not.toHaveBeenCalled();
  });

  it("fails if the companion cannot open logs", async () => {
    mockProvider({
      isActive: true,
      exports: { getVariantAnalysisServerToken },
    });
    await expect(openServerVariantAnalysisLogs(run)).rejects.toThrow(
      "does not support viewing logs",
    );
  });
});

describe("server log capabilities", () => {
  let run: ReturnType<typeof createMockVariantAnalysis>;
  let configurationChanged: EventEmitter<ConfigurationChangeEvent>;
  let watcher: Disposable;

  beforeEach(async () => {
    await configureServer();
    run = { ...createMockVariantAnalysis({}), serverUrl: SERVER_URL };
    configurationChanged = new EventEmitter<ConfigurationChangeEvent>();
    jest
      .spyOn(workspace, "onDidChangeConfiguration")
      .mockImplementation(configurationChanged.event);
    watcher = watchVariantAnalysisLogCapabilities();
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

  it("discovers log support in the background, once per server and provider", async () => {
    const activate = jest.fn().mockResolvedValue({
      getVariantAnalysisServerToken,
      openVariantAnalysisLogs: jest.fn(),
    });
    mockProvider({ isActive: false, activate });

    const finished = discoveryFinished();
    expect(withVariantAnalysisLogCapability(run)).toEqual({
      ...run,
      canViewLogs: false,
    });
    expect(canViewServerVariantAnalysisLogs({ ...run, id: run.id + 1 })).toBe(
      false,
    );
    await finished;
    expect(withVariantAnalysisLogCapability(run)).toEqual({
      ...run,
      canViewLogs: true,
    });
    expect(activate).toHaveBeenCalledTimes(1);
    expect(getVariantAnalysisServerToken).not.toHaveBeenCalled();

    const githubRun = createMockVariantAnalysis({});
    expect(withVariantAnalysisLogCapability(githubRun)).toBe(githubRun);
    await setSetting("serverUrl", "https://other.example.com");
    expect(canViewServerVariantAnalysisLogs(run)).toBe(false);
  });

  it.each(["missing", "failed", "stalled"])(
    "hides logs, without retrying, when the provider is %s",
    async (state) => {
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
        for (let id = 0; id < 10; id++) {
          expect(canViewServerVariantAnalysisLogs({ ...run, id })).toBe(false);
        }
        if (state === "stalled") {
          await jest.advanceTimersByTimeAsync(30_000);
          expect(jest.getTimerCount()).toBe(0);
        }
        await finished;
        expect(canViewServerVariantAnalysisLogs(run)).toBe(false);
        expect(lookup).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(
          expect.stringContaining("Unable to discover variant analysis logs"),
        );
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it.each(["serverUrl", "serverTokenProvider"])(
    "invalidates discovery on %s changes and ignores stale completions",
    async (setting) => {
      let finishActivation!: (
        provider: Partial<VariantAnalysisServerTokenProvider>,
      ) => void;
      const activate = jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            finishActivation = resolve;
          }),
      );
      mockProvider({ isActive: false, activate });
      const changed = jest.fn();
      const subscription = onDidChangeVariantAnalysisLogCapabilities(changed);
      try {
        expect(canViewServerVariantAnalysisLogs(run)).toBe(false);
        const oldActivation = finishActivation;
        configurationChanged.fire({
          affectsConfiguration: (key) =>
            key === `codeQL.variantAnalysis.${setting}`,
        });
        expect(changed).toHaveBeenCalledTimes(1);
        expect(canViewServerVariantAnalysisLogs(run)).toBe(false);
        expect(activate).toHaveBeenCalledTimes(2);

        const finished = discoveryFinished();
        finishActivation({});
        await finished;
        expect(canViewServerVariantAnalysisLogs(run)).toBe(false);
        oldActivation({ openVariantAnalysisLogs: jest.fn() });
        // Drain the obsolete discovery's continuation without a real timer.
        await setImmediate();
        expect(canViewServerVariantAnalysisLogs(run)).toBe(false);
        expect(changed).toHaveBeenCalledTimes(2);
        expect(activate).toHaveBeenCalledTimes(2);
      } finally {
        subscription.dispose();
      }
    },
  );
});

describe("variant analysis routing", () => {
  // Valid as a variant analysis and as a repository task.
  const response = {
    id: 5,
    controller_repo: { id: 0 },
    scanned_repositories: [{ repository: { id: 7, full_name: "a.b/.github" } }],
    repository: { id: 7, full_name: "group/sub/c.js" },
  };
  let credentials: ReturnType<typeof testCredentialsWithStub>;

  beforeEach(() => {
    credentials = testCredentialsWithStub();
    fetchSpy.mockImplementation(
      async () => new Response(JSON.stringify(response)),
    );
  });

  it("uses GitHub when no server is configured", async () => {
    await expect(
      submitVariantAnalysis(credentials, createMockSubmission()),
    ).rejects.toThrow("no stub was provided");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("submits, polls, and cancels on the configured server", async () => {
    await configureServer();
    const submission = {
      ...createMockSubmission(),
      controllerRepoId: 0,
      serverUrl: SERVER_URL,
    };
    const run = {
      ...createMockVariantAnalysis({}),
      id: -1,
      serverRunId: 5,
      controllerRepo: { id: 0, fullName: "", private: true },
      serverUrl: SERVER_URL,
    };

    await expect(
      submitVariantAnalysis(credentials, submission),
    ).resolves.toEqual(response);
    await getVariantAnalysis(credentials, 0, 5, SERVER_URL);
    await getVariantAnalysisRepo(credentials, 0, 5, 7, SERVER_URL);
    fetchSpy.mockResolvedValue(new Response(null, { status: 202 }));
    await cancelVariantAnalysis(credentials, run);

    const analyses = `${SERVER_URL}/repositories/0/code-scanning/codeql/variant-analyses`;
    expect(
      fetchSpy.mock.calls.map(([url, init]) => [init?.method, url]),
    ).toEqual([
      ["POST", analyses],
      ["GET", `${analyses}/5`],
      ["GET", `${analyses}/5/repositories/7`],
      ["POST", `${analyses}/5/cancel`],
    ]);
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toMatchObject(
      {
        action_repo_ref: submission.actionRepoRef,
        language: submission.language,
        query_pack: submission.pack,
      },
    );
  });

  it("reports an invalid response when submission returns JSON null", async () => {
    await configureServer();
    fetchSpy.mockResolvedValueOnce(new Response("null"));

    await expect(
      submitVariantAnalysis(credentials, {
        ...createMockSubmission(),
        serverUrl: SERVER_URL,
      }),
    ).rejects.toThrow(
      "The variant analysis server returned an invalid response",
    );
  });

  it("accepts a null scanned repository list", async () => {
    await configureServer();
    const body = { ...response, scanned_repositories: null };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(body)));

    await expect(
      getVariantAnalysis(credentials, 0, 5, SERVER_URL),
    ).resolves.toEqual(body);
  });

  it.each([
    {},
    { ...response, scanned_repositories: {} },
    { ...response, scanned_repositories: [{}] },
  ])("reports an invalid response when polling returns %j", async (body) => {
    await configureServer();
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(body)));

    await expect(
      getVariantAnalysis(credentials, 0, 5, SERVER_URL),
    ).rejects.toThrow(
      "The variant analysis server returned an invalid response",
    );
  });

  it.each([null, {}])(
    "reports an invalid response when a repository task returns %j",
    async (body) => {
      await configureServer();
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(body)));

      await expect(
        getVariantAnalysisRepo(credentials, 0, 5, 7, SERVER_URL),
      ).rejects.toThrow(
        "The variant analysis server returned an invalid response",
      );
    },
  );

  it.each([
    { id: "../5" },
    { controller_repo: { id: 0.5 } },
    { scanned_repositories: [{ repository: { id: 7, full_name: "../x" } }] },
    { repository: { id: "7", full_name: "x/y" } },
    { repository: { id: 7, full_name: "x/.." } },
    { repository: { id: 7, full_name: "x//y" } },
    { repository: { id: 7, full_name: "x/..\\y" } },
    { repository: { id: 7, full_name: "C:/x" } },
    { repository: { id: 7, full_name: 7 } },
  ])("rejects unsafe IDs and repository names: %j", async (change) => {
    await configureServer();
    fetchSpy.mockImplementation(
      async () => new Response(JSON.stringify({ ...response, ...change })),
    );
    await expect(
      Promise.all([
        getVariantAnalysis(credentials, 0, 5, SERVER_URL),
        getVariantAnalysisRepo(credentials, 0, 5, 7, SERVER_URL),
      ]),
    ).rejects.toThrow("IDs must be integers");
  });

  it("only sends a run to the server that ran it", async () => {
    const githubRun = createMockVariantAnalysis({});
    const serverRun = { ...githubRun, serverUrl: SERVER_URL };

    await configureServer();
    await expect(getVariantAnalysis(credentials, 0, 5)).rejects.toThrow(
      "Clear codeQL.variantAnalysis.serverUrl",
    );
    await expect(cancelVariantAnalysis(credentials, githubRun)).rejects.toThrow(
      /different server/,
    );

    await setSetting("serverUrl", "https://other.example.com");
    await expect(
      getVariantAnalysis(credentials, 0, 5, SERVER_URL),
    ).rejects.toThrow(`Set codeQL.variantAnalysis.serverUrl to ${SERVER_URL}`);
    await expect(cancelVariantAnalysis(credentials, serverRun)).rejects.toThrow(
      /different server/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("repository lists with a custom server", () => {
  it("hides system-defined repository lists", async () => {
    const config = new VariantAnalysisConfigListener();
    try {
      expect(config.showSystemDefinedRepositoryLists).toBe(true);
      await setSetting("serverUrl", SERVER_URL);
      expect(config.showSystemDefinedRepositoryLists).toBe(false);
    } finally {
      config.dispose();
    }
  });
});
