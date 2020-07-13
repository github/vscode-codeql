import { expect } from 'chai';
import 'mocha';
import { LocationStyle, StringLocation } from '../../src/bqrs-types';
import { tryGetResolvableLocation } from 'semmle-bqrs';

describe('processing string locations', function () {
  it('should detect Windows whole-file locations', function () {
    const loc: StringLocation = {
      t: LocationStyle.String,
      loc: 'file://C:/path/to/file.ext:0:0:0:0'
    };
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).to.eql({t: LocationStyle.WholeFile, file: 'C:/path/to/file.ext'});
  });
  it('should detect Unix whole-file locations', function () {
    const loc: StringLocation = {
      t: LocationStyle.String,
      loc: 'file:///path/to/file.ext:0:0:0:0'
    };
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).to.eql({t: LocationStyle.WholeFile, file: '/path/to/file.ext'});
  });
  it('should detect Unix 5-part locations', function () {
    const loc: StringLocation = {
      t: LocationStyle.String,
      loc: 'file:///path/to/file.ext:1:2:3:4'
    };
    const wholeFileLoc = tryGetResolvableLocation(loc);
    expect(wholeFileLoc).to.eql({
      t: LocationStyle.FivePart,
      file: '/path/to/file.ext',
      lineStart: 1,
      colStart: 2,
      lineEnd: 3,
      colEnd: 4
    });
  });
  it('should ignore other string locations', function () {
    for (const loc of ['file:///path/to/file.ext', 'I am not a location']) {
      const wholeFileLoc = tryGetResolvableLocation({
        t: LocationStyle.String,
        loc: loc
      });
      expect(wholeFileLoc).to.be.undefined;
    }
  });
});
