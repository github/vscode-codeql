import {
  getVersionInformation,
  parseElectronVersion,
} from "../../../../scripts/util/vscode-versions";

const electronReleases = [
  {
    version: "29.4.0",
    node: "20.9.0",
    chrome: "122.0.6261.156",
  },
  {
    version: "42.10.0",
    node: "24.18.1",
    chrome: "148.0.7778.280",
  },
];

function mockFetch(
  responses: Record<string, unknown>,
): jest.SpiedFunction<typeof fetch> {
  return jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input.toString();
    const response = responses[url];
    if (response === undefined) {
      throw new Error(`Unexpected URL: ${url}`);
    }

    return {
      ok: true,
      json: async () => response,
      text: async () => response,
    } as Response;
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("parseElectronVersion", () => {
  it("parses the Electron target from a VS Code .npmrc", () => {
    expect(
      parseElectronVersion(
        ['target="42.10.0"', 'runtime="electron"', "disturl=example"].join(
          "\n",
        ),
      ),
    ).toBe("42.10.0");
  });

  it.each([
    ["a missing target", 'runtime="electron"'],
    ["an invalid target", 'target="not-a-version"'],
    ["an unquoted target", "target=42.10.0"],
  ])("rejects %s", (_description, npmrc) => {
    expect(() => parseElectronVersion(npmrc)).toThrow(
      "Could not find a valid Electron version in VS Code .npmrc",
    );
  });
});

describe("getVersionInformation", () => {
  it("reads Electron from package.json for older VS Code releases", async () => {
    const fetchMock = mockFetch({
      "https://raw.githubusercontent.com/microsoft/vscode/1.90.0/package.json":
        {
          devDependencies: {
            electron: "29.4.0",
          },
        },
      "https://releases.electronjs.org/releases.json": electronReleases,
    });

    await expect(getVersionInformation("1.90.0")).resolves.toEqual({
      vscodeVersion: "1.90.0",
      electronVersion: "29.4.0",
      nodeVersion: "20.9.0",
      chromiumVersion: "122.0.6261.156",
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/microsoft/vscode/1.90.0/.npmrc",
    );
  });

  it("falls back to .npmrc for newer VS Code releases", async () => {
    mockFetch({
      "https://raw.githubusercontent.com/microsoft/vscode/1.137.0/package.json":
        {
          devDependencies: {},
        },
      "https://raw.githubusercontent.com/microsoft/vscode/1.137.0/.npmrc":
        'target="42.10.0"\nruntime="electron"\n',
      "https://releases.electronjs.org/releases.json": electronReleases,
    });

    await expect(getVersionInformation("1.137.0")).resolves.toEqual({
      vscodeVersion: "1.137.0",
      electronVersion: "42.10.0",
      nodeVersion: "24.18.1",
      chromiumVersion: "148.0.7778.280",
    });
  });
});
