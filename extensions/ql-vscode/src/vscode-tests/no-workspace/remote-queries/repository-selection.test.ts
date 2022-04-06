import 'vscode-test';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { window } from 'vscode';
import * as pq from 'proxyquire';

const proxyquire = pq.noPreserveCache();

describe('repository-selection', function() {

  describe('getRepositorySelection', () => {
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
      mod = proxyquire('../../../remote-queries/repository-selection', {
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

    it('should allow selection from repo lists from your pre-defined config', async () => {
      // fake return values
      quickPickSpy.resolves(
        { repositories: ['foo/bar', 'foo/baz'] }
      );
      getRemoteRepositoryListsSpy.returns(
        {
          'list1': ['foo/bar', 'foo/baz'],
          'list2': [],
        }
      );

      // make the function call
      const repoSelection = await mod.getRepositorySelection();

      // Check that the return value is correct
      expect(repoSelection.repositoryLists).to.be.undefined;
      expect(repoSelection.repositories).to.deep.eq(
        ['foo/bar', 'foo/baz']
      );
    });

    it('should allow selection from repo lists defined at the system level', async () => {
      // fake return values
      quickPickSpy.resolves(
        { repositoryList: 'top_100' }
      );
      getRemoteRepositoryListsSpy.returns(
        {
          'list1': ['foo/bar', 'foo/baz'],
          'list2': [],
        }
      );

      // make the function call
      const repoSelection = await mod.getRepositorySelection();

      // Check that the return value is correct
      expect(repoSelection.repositories).to.be.undefined;
      expect(repoSelection.repositoryLists).to.deep.eq(
        ['top_100']
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
        quickPickSpy.resolves(
          { useCustomRepository: true }
        );
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(repo);

        // make the function call
        const repoSelection = await mod.getRepositorySelection();

        // Check that the return value is correct
        expect(repoSelection.repositories).to.deep.equal(
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
        quickPickSpy.resolves(
          { useCustomRepository: true }
        );
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(repo);

        // make the function call
        await mod.getRepositorySelection();

        // check that we get the right error message
        expect(showAndLogErrorMessageSpy.firstCall.args[0]).to.contain('Invalid repository format');
      });
    });

  });
});
