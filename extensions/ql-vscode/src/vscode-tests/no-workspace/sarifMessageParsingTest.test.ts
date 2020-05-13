import 'mocha';
import { expect } from "chai";

import { parseSarifPlainTextMessage } from '../../sarif-utils';


describe('parsing sarif', () => {
  it('should be able to parse a simple message from the spec', async function() {
    const message = "Tainted data was used. The data came from [here](3).";
    const results = parseSarifPlainTextMessage(message);
    expect(results).to.deep.equal([
      "Tainted data was used. The data came from ",
      { dest: 3, text: "here" }, "."
    ]);
  });

  it('should be able to parse a complex message from the spec', async function() {
    const message = "Prohibited term used in [para\\[0\\]\\\\spans\\[2\\]](1).";
    const results = parseSarifPlainTextMessage(message);
    expect(results).to.deep.equal([
      "Prohibited term used in ",
      { dest: 1, text: "para[0]\\spans[2]" }, "."
    ]);
  });
  it('should be able to parse a broken complex message from the spec', async function() {
    const message = "Prohibited term used in [para\\[0\\]\\\\spans\\[2\\](1).";
    const results = parseSarifPlainTextMessage(message);
    expect(results).to.deep.equal([
      "Prohibited term used in [para[0]\\spans[2](1)."
    ]);
  });
  it('should be able to parse a message with extra escaping the spec', async function() {
    const message = "Tainted data was used. The data came from \\[here](3).";
    const results = parseSarifPlainTextMessage(message);
    expect(results).to.deep.equal([
      "Tainted data was used. The data came from [here](3)."
    ]);
  });
});
