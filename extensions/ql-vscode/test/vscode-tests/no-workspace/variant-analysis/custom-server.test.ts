import { ConfigurationTarget, extensions, window, workspace } from "vscode";
import type { Extension } from "vscode";
import type { AppCommandManager } from "../../../../src/common/commands";
import {
  getVariantAnalysisServerConfig,
  isVariantAnalysisServerConfigured,
} from "../../../../src/config";
import { exportVariantAnalysisResults } from "../../../../src/variant-analysis/export-results";
import type { VariantAnalysisServerTokenProvider } from "../../../../src/variant-analysis/gh-api/variant-analysis-server-client";
import { requestVariantAnalysisServer } from "../../../../src/variant-analysis/gh-api/variant-analysis-server-client";
import { openServerVariantAnalysisLogs } from "../../../../src/variant-analysis/variant-analysis-api";
import type { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { testCredentialsWithStub } from "../../../factories/authentication";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
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
  it.each([undefined, null, " "])(
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
    42,
  ])("rejects %p but still counts it as configured", async (url) => {
    await setSetting("serverUrl", url);
    expect(() => getVariantAnalysisServerConfig()).toThrow();
    expect(isVariantAnalysisServerConfigured()).toBe(true);
  });
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
    await openServerVariantAnalysisLogs(run);
    expect(openVariantAnalysisLogs).toHaveBeenCalledWith(SERVER_URL, run.id);
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
