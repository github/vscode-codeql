import { expect } from "chai";
import "mocha";
import { tryParseVersionString } from "../../cli-version";

describe("Version parsing", () => {
  it("should accept version without prerelease and build metadata", () => {
    const v = tryParseVersionString("3.2.4")!;
    expect(v.majorVersion).to.equal(3);
    expect(v.minorVersion).to.equal(2);
    expect(v.patchVersion).to.equal(4);
    expect(v.prereleaseVersion).to.be.undefined;
    expect(v.buildMetadata).to.be.undefined;
  });

  it("should accept v at the beginning of the version", () => {
    const v = tryParseVersionString("v3.2.4")!;
    expect(v.majorVersion).to.equal(3);
    expect(v.minorVersion).to.equal(2);
    expect(v.patchVersion).to.equal(4);
    expect(v.prereleaseVersion).to.be.undefined;
    expect(v.buildMetadata).to.be.undefined;
  });

  it("should accept version with prerelease", () => {
    const v = tryParseVersionString("v3.2.4-alpha.0")!;
    expect(v.majorVersion).to.equal(3);
    expect(v.minorVersion).to.equal(2);
    expect(v.patchVersion).to.equal(4);
    expect(v.prereleaseVersion).to.equal("alpha.0");
    expect(v.buildMetadata).to.be.undefined;
  });

  it("should accept version with prerelease and build metadata", () => {
    const v = tryParseVersionString("v3.2.4-alpha.0+abcdef0")!;
    expect(v.majorVersion).to.equal(3);
    expect(v.minorVersion).to.equal(2);
    expect(v.patchVersion).to.equal(4);
    expect(v.prereleaseVersion).to.equal("alpha.0");
    expect(v.buildMetadata).to.equal("abcdef0");
  });

  it("should accept version with build metadata", () => {
    const v = tryParseVersionString("v3.2.4+abcdef0")!;
    expect(v.majorVersion).to.equal(3);
    expect(v.minorVersion).to.equal(2);
    expect(v.patchVersion).to.equal(4);
    expect(v.prereleaseVersion).to.be.undefined;
    expect(v.buildMetadata).to.equal("abcdef0");
  });
});
