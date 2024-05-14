import {
  getNwoFromGitHubUrl,
  getOwnerFromGitHubUrl,
  isValidGitHubNwo,
  isValidGitHubOwner,
} from "../../../src/common/github-url-identifier-helper";

describe("github url identifier helper", () => {
  const githubUrl = new URL("https://github.com");

  describe("valid GitHub Nwo Or Owner method", () => {
    it("should return true for valid owner", () => {
      expect(isValidGitHubOwner("github")).toBe(true);
    });
    it("should return true for valid NWO", () => {
      expect(isValidGitHubNwo("github/codeql")).toBe(true);
    });
    it("should return false for invalid owner", () => {
      expect(isValidGitHubOwner("github/codeql")).toBe(false);
    });
    it("should return false for invalid NWO", () => {
      expect(isValidGitHubNwo("githubl")).toBe(false);
    });
  });

  describe("getNwoFromGitHubUrl method", () => {
    it("should handle invalid urls", () => {
      expect(getNwoFromGitHubUrl("", githubUrl)).toBe(undefined);
      expect(
        getNwoFromGitHubUrl("https://ww.github.com/foo/bar", githubUrl),
      ).toBe(undefined);
      expect(
        getNwoFromGitHubUrl("https://tenant.ghe.com/foo/bar", githubUrl),
      ).toBe(undefined);
      expect(getNwoFromGitHubUrl("https://www.github.com/foo", githubUrl)).toBe(
        undefined,
      );
      expect(getNwoFromGitHubUrl("foo", githubUrl)).toBe(undefined);
      expect(getNwoFromGitHubUrl("foo/bar", githubUrl)).toBe(undefined);
    });

    it("should handle valid urls", () => {
      expect(getNwoFromGitHubUrl("github.com/foo/bar", githubUrl)).toBe(
        "foo/bar",
      );
      expect(getNwoFromGitHubUrl("www.github.com/foo/bar", githubUrl)).toBe(
        "foo/bar",
      );
      expect(getNwoFromGitHubUrl("https://github.com/foo/bar", githubUrl)).toBe(
        "foo/bar",
      );
      expect(getNwoFromGitHubUrl("http://github.com/foo/bar", githubUrl)).toBe(
        "foo/bar",
      );
      expect(
        getNwoFromGitHubUrl("https://www.github.com/foo/bar", githubUrl),
      ).toBe("foo/bar");
      expect(
        getNwoFromGitHubUrl("https://github.com/foo/bar/sub/pages", githubUrl),
      ).toBe("foo/bar");
      expect(
        getNwoFromGitHubUrl(
          "https://tenant.ghe.com/foo/bar",
          new URL("https://tenant.ghe.com"),
        ),
      ).toBe("foo/bar");
    });
  });

  describe("getOwnerFromGitHubUrl method", () => {
    it("should handle invalid urls", () => {
      expect(getOwnerFromGitHubUrl("", githubUrl)).toBe(undefined);
      expect(
        getOwnerFromGitHubUrl("https://ww.github.com/foo/bar", githubUrl),
      ).toBe(undefined);
      expect(
        getOwnerFromGitHubUrl("https://tenant.ghe.com/foo/bar", githubUrl),
      ).toBe(undefined);
      expect(getOwnerFromGitHubUrl("foo", githubUrl)).toBe(undefined);
      expect(getOwnerFromGitHubUrl("foo/bar", githubUrl)).toBe(undefined);
    });

    it("should handle valid urls", () => {
      expect(
        getOwnerFromGitHubUrl("http://github.com/foo/bar", githubUrl),
      ).toBe("foo");
      expect(
        getOwnerFromGitHubUrl("https://github.com/foo/bar", githubUrl),
      ).toBe("foo");
      expect(
        getOwnerFromGitHubUrl("https://www.github.com/foo/bar", githubUrl),
      ).toBe("foo");
      expect(
        getOwnerFromGitHubUrl(
          "https://github.com/foo/bar/sub/pages",
          githubUrl,
        ),
      ).toBe("foo");
      expect(
        getOwnerFromGitHubUrl("https://www.github.com/foo", githubUrl),
      ).toBe("foo");
      expect(getOwnerFromGitHubUrl("github.com/foo", githubUrl)).toBe("foo");
      expect(getOwnerFromGitHubUrl("www.github.com/foo", githubUrl)).toBe(
        "foo",
      );
      expect(
        getOwnerFromGitHubUrl(
          "https://tenant.ghe.com/foo/bar",
          new URL("https://tenant.ghe.com"),
        ),
      ).toBe("foo");
      expect(
        getOwnerFromGitHubUrl(
          "https://tenant.ghe.com/foo",
          new URL("https://tenant.ghe.com"),
        ),
      ).toBe("foo");
    });
  });
});
