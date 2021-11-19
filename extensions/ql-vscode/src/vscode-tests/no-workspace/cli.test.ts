import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { CodeQLCliServer } from '../../cli';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe.only('cliServerTests', function() {

  it('should parse a valid SARIF file', async () => {
    const result = await CodeQLCliServer.parseSarif(__dirname + '/data/sarif/validSarif.sarif');
    expect(result.version).to.exist;
    expect(result.runs).to.exist;
    expect(result.runs[0].tool).to.exist;
    expect(result.runs[0].tool.driver).to.exist;
  });

  it('should return an empty array if there are no results', async () => {
    const result = await CodeQLCliServer.parseSarif(__dirname + '/data/sarif/emptyResultsSarif.sarif');
    expect(result.runs[0].results).to.be.empty;
  });
});