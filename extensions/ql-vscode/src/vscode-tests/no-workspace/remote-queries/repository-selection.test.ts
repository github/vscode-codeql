import * as sinon from 'sinon';
import { expect } from 'chai';
import { window } from 'vscode';
import * as pq from 'proxyquire';
import { UserCancellationException } from '../../../commandRunner';

const proxyquire = pq.noPreserveCache();

describe('repository-selection', function() {

  describe('getRepositorySelection', () => {
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
      mod = proxyquire('../../../remote-queries/repository-selection', {
        '../config': {
          getRemoteRepositoryLists: getRemoteRepositoryListsSpy
        },
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should allow selection from repo lists from your pre-defined config', async () => {
      // Fake return values
      quickPickSpy.resolves(
        { repositories: ['foo/bar', 'foo/baz'] }
      );
      getRemoteRepositoryListsSpy.returns(
        {
          'list1': ['foo/bar', 'foo/baz'],
          'list2': [],
        }
      );

      // Make the function call
      const repoSelection = await mod.getRepositorySelection();

      // Check that the return value is correct
      expect(repoSelection.repositoryLists).to.be.undefined;
      expect(repoSelection.owners).to.be.undefined;
      expect(repoSelection.repositories).to.deep.eq(
        ['foo/bar', 'foo/baz']
      );
    });

    it('should allow selection from repo lists defined at the system level', async () => {
      // Fake return values
      quickPickSpy.resolves(
        { repositoryList: 'top_100' }
      );
      getRemoteRepositoryListsSpy.returns(
        {
          'list1': ['foo/bar', 'foo/baz'],
          'list2': [],
        }
      );

      // Make the function call
      const repoSelection = await mod.getRepositorySelection();

      // Check that the return value is correct
      expect(repoSelection.repositories).to.be.undefined;
      expect(repoSelection.owners).to.be.undefined;
      expect(repoSelection.repositoryLists).to.deep.eq(
        ['top_100']
      );
    });

    // Test the owner regex in various "good" cases
    const goodOwners = [
      'owner',
      'owner-with-hyphens',
      'ownerWithNumbers58'
    ];
    goodOwners.forEach(owner => {
      it(`should run on a valid owner that you enter in the text box: ${owner}`, async () => {
        // Fake return values
        quickPickSpy.resolves(
          { useAllReposOfOwner: true }
        );
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(owner);

        // Make the function call
        const repoSelection = await mod.getRepositorySelection();

        // Check that the return value is correct
        expect(repoSelection.repositories).to.be.undefined;
        expect(repoSelection.repositoryLists).to.be.undefined;
        expect(repoSelection.owners).to.deep.eq([owner]);
      });
    });

    // Test the owner regex in various "bad" cases
    const badOwners = [
      'invalid_owner',
      'owner-with-repo/repo'
    ];
    badOwners.forEach(owner => {
      it(`should show an error message if you enter an invalid owner in the text box: ${owner}`, async () => {
        // Fake return values
        quickPickSpy.resolves(
          { useAllReposOfOwner: true }
        );
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(owner);

        // Function call should throw a UserCancellationException
        await expect(mod.getRepositorySelection()).to.be.rejectedWith(Error, `Invalid user or organization: ${owner}`);
      });
    });

    // Test the repo regex in various "good" cases
    const goodRepos = [
      'owner/repo',
      'owner-with-hyphens/repo-with-hyphens_and_underscores',
      'ownerWithNumbers58/repoWithNumbers37'
    ];
    goodRepos.forEach(repo => {
      it(`should run on a valid repo that you enter in the text box: ${repo}`, async () => {
        // Fake return values
        quickPickSpy.resolves(
          { useCustomRepo: true }
        );
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(repo);

        // Make the function call
        const repoSelection = await mod.getRepositorySelection();

        // Check that the return value is correct
        expect(repoSelection.repositoryLists).to.be.undefined;
        expect(repoSelection.owners).to.be.undefined;
        expect(repoSelection.repositories).to.deep.equal(
          [repo]
        );
      });
    });

    // Test the repo regex in various "bad" cases
    const badRepos = [
      'invalid_owner/repo',
      'owner/repo+some&invalid&stuff',
      'owner-with-no-repo/',
      '/repo-with-no-owner'
    ];
    badRepos.forEach(repo => {
      it(`should show an error message if you enter an invalid repo in the text box: ${repo}`, async () => {
        // Fake return values
        quickPickSpy.resolves(
          { useCustomRepo: true }
        );
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(repo);

        // Function call should throw a UserCancellationException
        await expect(mod.getRepositorySelection()).to.be.rejectedWith(UserCancellationException, 'Invalid repository format');
      });
    });

  });
});
