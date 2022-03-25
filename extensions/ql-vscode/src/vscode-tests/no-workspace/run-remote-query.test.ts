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
    let showAndLogErrorMessageSpy: sinon.SinonStub;
    let mod: any;
    beforeEach(() => {
      sandbox = sinon.createSandbox();
      quickPickSpy = sandbox.stub(window, 'showQuickPick');
      showInputBoxSpy = sandbox.stub(window, 'showInputBox');
      getRemoteRepositoryListsSpy = sandbox.stub();
      showAndLogErrorMessageSpy = sandbox.stub();
      mod = proxyquire('../../remote-queries/run-remote-query', {
        '../config': {
          getRemoteRepositoryLists: getRemoteRepositoryListsSpy
        },
        '../helpers': {
          showAndLogErrorMessage: showAndLogErrorMessageSpy
        },
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should run on a repo list that you chose from your pre-defined config', async () => {
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

    // Test the regex in various "good" cases
    const goodRepos = [
      'owner/repo',
      'owner-with-hyphens/repo-with-hyphens_and_underscores',
      'ownerWithNumbers58/repoWithNumbers37'
    ];
    goodRepos.forEach(repo => {
      it(`should run on a valid repo that you enter in the text box: ${repo}`, async () => {
        // fake return values
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(repo);

        // make the function call
        const repoList = await mod.getRepositories();

        // Check that the return value is correct
        expect(repoList).to.deep.equal(
          [repo]
        );
      });
    });

    // Test the regex in various "bad" cases
    const badRepos = [
      'invalid_owner/repo',
      'owner/repo+some&invalid&stuff',
      'owner-with-no-repo/',
      '/repo-with-no-owner'
    ];
    badRepos.forEach(repo => {
      it(`should show an error message if you enter an invalid repo in the text box: ${repo}`, async () => {
        // fake return values
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(repo);

        // make the function call
        await mod.getRepositories();

        // check that we get the right error message
        expect(showAndLogErrorMessageSpy.firstCall.args[0]).to.contain('Invalid repository format');
      });
    });

  });
});
