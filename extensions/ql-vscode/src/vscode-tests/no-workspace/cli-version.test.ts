import { expect } from "chai";
import "mocha";
import { parse } from "semver";

describe("Version parsing", () => {
  it("should accept version without prerelease and build metadata", () => {
    const v = parse("3.2.4")!;
    expect(v.major).to.equal(3);
    expect(v.minor).to.equal(2);
    expect(v.patch).to.equal(4);
    expect(v.prerelease).to.eql([]);
    expect(v.build).to.eql([]);
  });

  it("should accept v at the beginning of the version", () => {
    const v = parse("v3.2.4")!;
    expect(v.major).to.equal(3);
    expect(v.minor).to.equal(2);
    expect(v.patch).to.equal(4);
    expect(v.prerelease).to.eql([]);
    expect(v.build).to.eql([]);
  });

  it("should accept version with prerelease", () => {
    const v = parse("v3.2.4-alpha0")!;
    expect(v.major).to.equal(3);
    expect(v.minor).to.equal(2);
    expect(v.patch).to.equal(4);
    expect(v.prerelease).to.eql(["alpha0"]);
    expect(v.build).to.eql([]);
  });

  it("should accept version with prerelease and build metadata", () => {
    const v = parse("v3.2.4-alpha0+abcdef0")!;
    expect(v.major).to.equal(3);
    expect(v.minor).to.equal(2);
    expect(v.patch).to.equal(4);
    expect(v.prerelease).to.eql(["alpha0"]);
    expect(v.build).to.eql(["abcdef0"]);
  });

  it("should accept version with build metadata", () => {
    const v = parse("v3.2.4+abcdef0")!;
    expect(v.major).to.equal(3);
    expect(v.minor).to.equal(2);
    expect(v.patch).to.equal(4);
    expect(v.prerelease).to.eql([]);
    expect(v.build).to.eql(["abcdef0"]);
  });
});
