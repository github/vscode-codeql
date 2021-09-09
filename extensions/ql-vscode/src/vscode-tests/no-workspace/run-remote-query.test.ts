import 'vscode-test';
import 'mocha';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as chai from 'chai';
import { window } from 'vscode';
import * as pq from 'proxyquire';

const proxyquire = pq.noPreserveCache();
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('run-remote-query', function() {

  describe('getRepositories', () => {
    let sandbox: sinon.SinonSandbox;
    let quickPickSpy: sinon.SinonStub;
    let showInputBoxSpy: sinon.SinonStub;
    let getRemoteRepositoryListsSpy: sinon.SinonStub;
    let mod: any;
    beforeEach(() => {
      sandbox = sinon.createSandbox();
      quickPickSpy = sandbox.stub(window, 'showQuickPick');
      showInputBoxSpy = sandbox.stub(window, 'showInputBox');
      getRemoteRepositoryListsSpy = sandbox.stub();
      mod = proxyquire('../../run-remote-query', {
        './config': {
          getRemoteRepositoryLists: getRemoteRepositoryListsSpy
        }
      });

    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should return a repo list that you chose from your pre-defined config', async () => {
      // fake return values
      quickPickSpy.resolves(
        { repoList: ['foo/bar', 'foo/baz'] }
      );
      getRemoteRepositoryListsSpy.returns(
        {
          'list1': ['foo/bar', 'foo/baz'],
          'list2': [],
        }
      );

      // make the function call
      const repoList = await mod.getRepositories();

      // Check that the return value is correct
      expect(repoList).to.deep.eq(
        ['foo/bar', 'foo/baz']
      );
    });

    it('should show a textbox if you have no repo lists configured', async () => {
      // fake return values
      showInputBoxSpy.resolves('foo/bar');
      getRemoteRepositoryListsSpy.returns({});

      // make the function call
      const repoList = await mod.getRepositories();

      // Check that the return value is correct
      expect(repoList).to.deep.equal(
        ['foo/bar']
      );
    });
  });

  describe('runRemoteQuery', () => {
    // TODO
  });
});
