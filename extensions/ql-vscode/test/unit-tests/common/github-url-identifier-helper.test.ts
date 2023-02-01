import {
  getNwoFromGitHubUrl,
  getOwnerFromGitHubUrl,
  isValidGitHubNwo,
  isValidGitHubOwner,
} from "../../../src/common/github-url-identifier-helper";

describe("github url identifier helper", () => {
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
      expect(getNwoFromGitHubUrl("")).toBe(undefined);
      expect(getNwoFromGitHubUrl("https://ww.github.com/foo/bar")).toBe(
        undefined,
      );
      expect(getNwoFromGitHubUrl("https://www.github.com/foo")).toBe(undefined);
      expect(getNwoFromGitHubUrl("foo")).toBe(undefined);
      expect(getNwoFromGitHubUrl("foo/bar")).toBe(undefined);
    });

    it("should handle valid urls", () => {
      expect(getNwoFromGitHubUrl("github.com/foo/bar")).toBe("foo/bar");
      expect(getNwoFromGitHubUrl("https://github.com/foo/bar")).toBe("foo/bar");
      expect(getNwoFromGitHubUrl("http://github.com/foo/bar")).toBe("foo/bar");
      expect(getNwoFromGitHubUrl("https://www.github.com/foo/bar")).toBe(
        "foo/bar",
      );
      expect(getNwoFromGitHubUrl("https://github.com/foo/bar/sub/pages")).toBe(
        "foo/bar",
      );
    });
  });

  describe("getOwnerFromGitHubUrl method", () => {
    it("should handle invalid urls", () => {
      expect(getOwnerFromGitHubUrl("")).toBe(undefined);
      expect(getOwnerFromGitHubUrl("https://ww.github.com/foo/bar")).toBe(
        undefined,
      );
      expect(getOwnerFromGitHubUrl("foo")).toBe(undefined);
      expect(getOwnerFromGitHubUrl("foo/bar")).toBe(undefined);
    });

    it("should handle valid urls", () => {
      expect(getOwnerFromGitHubUrl("http://github.com/foo/bar")).toBe("foo");
      expect(getOwnerFromGitHubUrl("https://github.com/foo/bar")).toBe("foo");
      expect(getOwnerFromGitHubUrl("https://www.github.com/foo/bar")).toBe(
        "foo",
      );
      expect(
        getOwnerFromGitHubUrl("https://github.com/foo/bar/sub/pages"),
      ).toBe("foo");
      expect(getOwnerFromGitHubUrl("https://www.github.com/foo")).toBe("foo");
      expect(getOwnerFromGitHubUrl("github.com/foo")).toBe("foo");
    });
  });
});
