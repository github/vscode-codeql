import { spawnSync } from "child_process";
import { writeFileSync } from "fs";
import { resolve, join } from "path";
import type { DirResult } from "tmp";
import { dirSync } from "tmp-promise";

describe("lockfile URL check", () => {
  let directory: DirResult;
  const script = resolve(__dirname, "../../../scripts/check-lockfile-urls.cjs");

  beforeEach(() => {
    directory = dirSync({ unsafeCleanup: true });
  });

  afterEach(() => {
    directory.removeCallback();
  });

  function check(packages: Record<string, unknown>) {
    const path = join(directory.name, "package-lock.json");
    writeFileSync(path, JSON.stringify({ lockfileVersion: 3, packages }));
    return spawnSync(process.execPath, [script, path], { encoding: "utf8" });
  }

  it("accepts public registry URLs and entries without resolved URLs", () => {
    const result = check({
      "": { name: "test" },
      "node_modules/example": {
        resolved: "https://registry.npmjs.org/example/-/example-1.0.0.tgz",
      },
      "node_modules/@scope/example": {
        resolved:
          "https://registry.npmjs.org/@scope/example/-/example-1.0.0.tgz",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it.each([
    "https://pkgs.dev.azure.com/example/package.tgz",
    "https://registry.npmjs.org.example.com/package.tgz",
    "http://registry.npmjs.org/package.tgz",
    "https://registry.npmjs.org:8443/package.tgz",
    "file:../example",
    "not-a-url",
    null,
  ])("rejects an invalid download location: %s", (resolved) => {
    const result = check({ "node_modules/example": { resolved } });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("node_modules/example");
  });

  it("rejects credentials without exposing them in diagnostics", () => {
    const result = check({
      "node_modules/example": {
        resolved:
          "https://user:example-password@registry.npmjs.org/package.tgz",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("without credentials");
    expect(result.stderr).not.toContain("example-password");
  });
});
