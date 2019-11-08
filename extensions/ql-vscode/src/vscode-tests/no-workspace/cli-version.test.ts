import { expect } from "chai";
import "mocha";
import { tryParseVersionString } from "../../cli-version";

describe("Version parsing", () => {
  ["+", "-", "."].forEach(separator => {
    it(`should accept ${separator} as separator for tail string`, () => {
      const v = tryParseVersionString(`2.1.0${separator}blah`)!;
      expect(v.majorVersion).to.equal(2);
      expect(v.minorVersion).to.equal(1);
      expect(v.patchVersion).to.equal(0);
      expect(v.tailString).to.equal("blah");
    });
  });
});
