import 'vscode-test';
import 'mocha';
import * as sinon from 'sinon';
import { Uri, WorkspaceFolder } from 'vscode';
import { expect } from 'chai';

import { QLTestAdapter } from '../../test-adapter';
import { CodeQLCliServer } from '../../cli';

describe('test-adapter', () => {
  let adapter: QLTestAdapter;
  let runTestsSpy: sinon.SinonStub;
  let resolveTestsSpy: sinon.SinonStub;
  let resolveQlpacksSpy: sinon.SinonStub;
  let sandox: sinon.SinonSandbox;

  beforeEach(() => {
    sandox = sinon.createSandbox();
    mockRunTests();
    resolveQlpacksSpy = sandox.stub().resolves({});
    resolveTestsSpy = sandox.stub().resolves([]);
    adapter = new QLTestAdapter({
      name: 'ABC',
      uri: Uri.parse('file:/ab/c')
    } as WorkspaceFolder, {
      runTests: runTestsSpy,
      resolveQlpacks: resolveQlpacksSpy,
      resolveTests: resolveTestsSpy
    } as unknown as CodeQLCliServer);
  });

  afterEach(() => {
    sandox.restore();
  });

  it('should run some tests', async () => {

    const listenerSpy = sandox.spy();
    adapter.testStates(listenerSpy);
    const testsPath = Uri.parse('file:/ab/c').fsPath;
    const dPath = Uri.parse('file:/ab/c/d.ql').fsPath;
    const gPath = Uri.parse('file:/ab/c/e/f/g.ql').fsPath;
    const hPath = Uri.parse('file:/ab/c/e/f/h.ql').fsPath;

    await adapter.run([testsPath]);

    expect(listenerSpy.getCall(0).args).to.deep.eq([
      { type: 'started', tests: [testsPath] }
    ]);
    expect(listenerSpy.getCall(1).args).to.deep.eq([{
      type: 'test',
      state: 'passed',
      test: dPath,
      message: undefined,
      decorations: []
    }]);
    expect(listenerSpy.getCall(2).args).to.deep.eq([{
      type: 'test',
      state: 'errored',
      test: gPath,
      message: `\nerrored: ${gPath}\npqr\nxyz\n`,
      decorations: [
        { line: 1, message: 'abc' }
      ]
    }]);
    expect(listenerSpy.getCall(3).args).to.deep.eq([{
      type: 'test',
      state: 'failed',
      test: hPath,
      message: `\nfailed: ${hPath}\njkh\ntuv\n`,
      decorations: []
    }]);
    expect(listenerSpy.getCall(4).args).to.deep.eq([{ type: 'finished' }]);
    expect(listenerSpy).to.have.callCount(5);
  });

  function mockRunTests() {
    // runTests is an async generator function. This is not directly supported in sinon
    // However, we can pretend the same thing by just returning an async array.
    runTestsSpy = sandox.stub();
    runTestsSpy.returns(
      (async function*() {
        yield Promise.resolve({
          test: Uri.parse('file:/ab/c/d.ql').fsPath,
          pass: true,
          messages: []
        });
        yield Promise.resolve({
          test: Uri.parse('file:/ab/c/e/f/g.ql').fsPath,
          pass: false,
          diff: ['pqr', 'xyz'],
          // a compile error
          messages: [
            { position: { line: 1 }, message: 'abc' }
          ]
        });
        yield Promise.resolve({
          test: Uri.parse('file:/ab/c/e/f/h.ql').fsPath,
          pass: false,
          diff: ['jkh', 'tuv'],
          messages: []
        });
      })()
    );
  }
});
