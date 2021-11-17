import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import { CodeQLCliServer } from '../../cli';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe.only('cliServerTests', () => {
  it('should parse a valid SARIF file', async () => {
    const result = await CodeQLCliServer.parseSarif(__dirname + '/data/sarif/validSarif.sarif');
    expect(result.runs.length).to.eq(1);
  });

  it('should return an empty array if there are no results', async () => {
    const result = await CodeQLCliServer.parseSarif(__dirname + '/data/sarif/emptyResultsSarif.sarif');
    expect(result.runs[0].results?.length).to.eq(0);
  });

  it('should throw an error if the file fails to parse', async () => {
    const result = await CodeQLCliServer.parseSarif(__dirname + '/data/sarif/invalidSarif.sarif');
    await expect(result).to.rejectedWith(/Error: Parsing output of interpretation failed: /);
  });
});