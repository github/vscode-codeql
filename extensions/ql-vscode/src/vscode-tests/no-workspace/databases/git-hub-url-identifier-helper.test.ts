import {
  getNwoOrOwnerFromGitHubUrl,
  validGitHubNwoOrOwner,
} from "../../../databases/git-hub-url-identifier-helper";

describe("github url identifier helper", () => {
  describe("valid GitHub Nwo Or Owner method", () => {
    it("should return true for valid owner", () => {
      expect(validGitHubNwoOrOwner("github", true)).toBe(true);
    });
    it("should return true for valid NWO", () => {
      expect(validGitHubNwoOrOwner("github/codeql")).toBe(true);
    });
    it("should return false for invalid owner", () => {
      expect(validGitHubNwoOrOwner("github/codeql", true)).toBe(false);
    });
    it("should return false for invalid NWO", () => {
      expect(validGitHubNwoOrOwner("githubl")).toBe(false);
    });
  });
});

describe("getNwoOrOwnerFromGitHubUrl method", () => {
  it("should handle invalid urls", () => {
    expect(getNwoOrOwnerFromGitHubUrl("")).toBe(undefined);
    expect(getNwoOrOwnerFromGitHubUrl("http://github.com/foo/bar")).toBe(
      undefined,
    );
    expect(getNwoOrOwnerFromGitHubUrl("https://ww.github.com/foo/bar")).toBe(
      undefined,
    );
    expect(getNwoOrOwnerFromGitHubUrl("https://www.github.com/foo")).toBe(
      undefined,
    );
    expect(getNwoOrOwnerFromGitHubUrl("foo")).toBe(undefined);
    expect(getNwoOrOwnerFromGitHubUrl("foo/bar")).toBe(undefined);
  });

  it("should handle valid urls", () => {
    expect(getNwoOrOwnerFromGitHubUrl("https://github.com/foo/bar")).toBe(
      "foo/bar",
    );
    expect(getNwoOrOwnerFromGitHubUrl("https://www.github.com/foo/bar")).toBe(
      "foo/bar",
    );
    expect(
      getNwoOrOwnerFromGitHubUrl("https://github.com/foo/bar/sub/pages"),
    ).toBe("foo/bar");
    expect(getNwoOrOwnerFromGitHubUrl("https://www.github.com/foo", true)).toBe(
      "foo",
    );
  });
});
