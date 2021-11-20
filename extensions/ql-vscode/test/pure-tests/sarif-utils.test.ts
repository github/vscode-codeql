import 'mocha';
import { expect } from 'chai';
import * as Sarif from 'sarif';
import * as path from 'path';

import {
  getPathRelativeToSourceLocationPrefix,
  parseSarifLocation,
  parseSarifPlainTextMessage,
  unescapeSarifText,
  parseSarif
} from '../../src/pure/sarif-utils';


describe('parsing sarif', () => {
  const sarifDir = path.join(path.dirname(__dirname), 'sarif');

  it('should be able to parse a simple message from the spec', async function() {
    const message = 'Tainted data was used. The data came from [here](3).';
    const results = parseSarifPlainTextMessage(message);
    expect(results).to.deep.equal([
      'Tainted data was used. The data came from ',
      { dest: 3, text: 'here' }, '.'
    ]);
  });

  it('should be able to parse a complex message from the spec', async function() {
    const message = 'Prohibited term used in [para\\[0\\]\\\\spans\\[2\\]](1).';
    const results = parseSarifPlainTextMessage(message);
    expect(results).to.deep.equal([
      'Prohibited term used in ',
      { dest: 1, text: 'para[0]\\spans[2]' }, '.'
    ]);
  });
  it('should be able to parse a broken complex message from the spec', async function() {
    const message = 'Prohibited term used in [para\\[0\\]\\\\spans\\[2\\](1).';
    const results = parseSarifPlainTextMessage(message);
    expect(results).to.deep.equal([
      'Prohibited term used in [para[0]\\spans[2](1).'
    ]);
  });
  it('should be able to parse a message with extra escaping the spec', async function() {
    const message = 'Tainted data was used. The data came from \\[here](3).';
    const results = parseSarifPlainTextMessage(message);
    expect(results).to.deep.equal([
      'Tainted data was used. The data came from [here](3).'
    ]);
  });

  it('should unescape sarif text', () => {
    expect(unescapeSarifText('\\\\ \\\\ \\[ \\[ \\] \\]')).to.eq('\\ \\ [ [ ] ]');
    // Also show that unescaped special chars are unchanged...is this correct?
    expect(unescapeSarifText('\\ \\ [ [ ] ]')).to.eq('\\ \\ [ [ ] ]');
  });

  it('should normalize source locations', () => {
    expect(getPathRelativeToSourceLocationPrefix('C:\\a\\b', '?x=test'))
      .to.eq('file:/C:/a/b/?x=test');
    expect(getPathRelativeToSourceLocationPrefix('C:\\a\\b', '%3Fx%3Dtest'))
      .to.eq('file:/C:/a/b/%3Fx%3Dtest');
    expect(getPathRelativeToSourceLocationPrefix('C:\\a =\\b c?', '?x=test'))
      .to.eq('file:/C:/a%20%3D/b%20c%3F/?x=test');
    expect(getPathRelativeToSourceLocationPrefix('/a/b/c', '?x=test'))
      .to.eq('file:/a/b/c/?x=test');
  });

  it('should parse a valid SARIF file', async () => {
    const result = await parseSarif(path.join(sarifDir, 'validSarif.sarif'));
    expect(result.version).to.exist;
    expect(result.runs).to.exist;
    expect(result.runs[0].tool).to.exist;
    expect(result.runs[0].tool.driver).to.exist;
    expect(result.runs.length).to.be.at.least(1);
  });

  it('should return an empty array if there are no results', async () => {
    const result = await parseSarif(path.join(sarifDir, 'emptyResultsSarif.sarif'));
    expect(result.runs[0].results).to.be.empty;
  });

  describe('parseSarifLocation', () => {
    it('should parse a sarif location with "no location"', () => {
      expect(parseSarifLocation({}, '')).to.deep.equal({
        hint: 'no physical location'
      });
      expect(parseSarifLocation({ physicalLocation: {} }, '')).to.deep.equal({
        hint: 'no artifact location'
      });
      expect(parseSarifLocation({ physicalLocation: { artifactLocation: {} } }, '')).to.deep.equal({
        hint: 'artifact location has no uri'
      });
    });

    it('should parse a sarif location with no region and no file protocol', () => {
      const location: Sarif.Location = {
        physicalLocation: {
          artifactLocation: {
            uri: 'abc?x=test'
          }
        }
      };
      expect(parseSarifLocation(location, 'prefix')).to.deep.equal({
        uri: 'file:/prefix/abc?x=test',
        userVisibleFile: 'abc?x=test'
      });
    });

    it('should parse a sarif location with no region and file protocol', () => {
      const location: Sarif.Location = {
        physicalLocation: {
          artifactLocation: {
            uri: 'file:/abc%3Fx%3Dtest'
          }
        }
      };
      expect(parseSarifLocation(location, 'prefix')).to.deep.equal({
        uri: 'file:/abc%3Fx%3Dtest',
        userVisibleFile: '/abc?x=test'
      });
    });

    it('should parse a sarif location with a region and file protocol', () => {
      const location: Sarif.Location = {
        physicalLocation: {
          artifactLocation: {
            uri: 'file:abc%3Fx%3Dtest'
          },
          region: {
            startLine: 1,
            startColumn: 2,
            endLine: 3,
            endColumn: 4
          }
        }
      };
      expect(parseSarifLocation(location, 'prefix')).to.deep.equal({
        uri: 'file:abc%3Fx%3Dtest',
        userVisibleFile: 'abc?x=test',
        startLine: 1,
        startColumn: 2,
        endLine: 3,
        endColumn: 3
      });
    });
  });
});
