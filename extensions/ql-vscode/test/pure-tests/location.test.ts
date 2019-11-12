import { expect } from 'chai';
import 'mocha';
import { LocationStyle, StringLocation, tryGetWholeFileLocation } from 'semmle-bqrs';

describe('processing string locations', function () {
  
  it('should detect Windows whole-file locations', function () {
    const loc: StringLocation = {
      t: LocationStyle.String,
      loc: 'file://C:/path/to/file.ext:0:0:0:0'
    };
    const wholeFileLoc = tryGetWholeFileLocation(loc);
    expect(wholeFileLoc).to.eql({t: LocationStyle.WholeFile, file: 'C:/path/to/file.ext'});
  });
  it('should detect Unix whole-file locations', function () {
    const loc: StringLocation = {
      t: LocationStyle.String,
      loc: 'file:///path/to/file.ext:0:0:0:0'
    };
    const wholeFileLoc = tryGetWholeFileLocation(loc);
    expect(wholeFileLoc).to.eql({t: LocationStyle.WholeFile, file: '/path/to/file.ext'});
  });
  it('should ignore other string locations', function () {
    for (const loc of ['file:///path/to/file.ext', 'I am not a location']) {
      const wholeFileLoc = tryGetWholeFileLocation({
        t: LocationStyle.String,
        loc: loc
      });
      expect(wholeFileLoc).to.be.undefined;
    }
  });
});
