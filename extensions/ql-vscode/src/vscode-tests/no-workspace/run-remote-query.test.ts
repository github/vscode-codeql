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

  describe('validateRepositories', () => {
    let sandbox: sinon.SinonSandbox;
    let showAndLogErrorMessageSpy: sinon.SinonStub;
    let showInformationMessageWithActionSpy: sinon.SinonStub;
    let mockRequest: sinon.SinonStub;
    let logSpy: sinon.SinonStub;
    let mod: any;

    const error = {
      message: 'Unable to run query on the specified repositories. Some repositories were invalid or don\'t have database uploads enabled.',
      response: {
        data: {
          invalid_repos: ['abc/def', 'ghi/jkl'],
          repos_without_db_uploads: ['mno/pqr', 'stu/vwx']
        }
      }
    };
    const ref = 'main';
    const language = 'javascript';
    const credentials = getMockCredentials(0);
    const query = 'select 1';

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      logSpy = sandbox.stub();
      showAndLogErrorMessageSpy = sandbox.stub();
      showInformationMessageWithActionSpy = sandbox.stub();
      mod = proxyquire('../../run-remote-query', {
        './helpers': {
          showAndLogErrorMessage: showAndLogErrorMessageSpy,
          showInformationMessageWithAction: showInformationMessageWithActionSpy
        },
        './logging': {
          'logger': {
            log: logSpy
          }
        },
      });
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should return and log error if it can\'t run on any repos', async () => {
      const repositories = ['abc/def', 'ghi/jkl', 'mno/pqr', 'stu/vwx'];

      // make the function call
      await mod.validateRepositories(error, credentials, ref, language, repositories, query);

      // check logging output
      expect(logSpy.firstCall.args[0]).to.contain('Unable to run query');
      expect(logSpy.secondCall.args[0]).to.contain('Invalid repos: abc/def, ghi/jkl');
      expect(logSpy.thirdCall.args[0]).to.contain('Repos without DB uploads: mno/pqr, stu/vwx');
      expect(showAndLogErrorMessageSpy.firstCall.args[0]).to.contain('Unable to run query on any');
    });

    it('should list invalid repos and repos without DB uploads, and rerun on valid ones', async () => {
      const repositories = ['foo/bar', 'abc/def', 'ghi/jkl', 'mno/pqr', 'foo/baz'];

      // fake return values
      showInformationMessageWithActionSpy.resolves(true);

      // make the function call
      await mod.validateRepositories(error, credentials, ref, language, repositories, query);

      // check logging output
      expect(logSpy.firstCall.args[0]).to.contain('Unable to run query');
      expect(logSpy.secondCall.args[0]).to.contain('Invalid repos: abc/def, ghi/jkl');
      expect(logSpy.thirdCall.args[0]).to.contain('Repos without DB uploads: mno/pqr');

      // check that the correct information message is displayed
      expect(showInformationMessageWithActionSpy.firstCall.args[0]).to.contain('Unable to run query on some');
      expect(showInformationMessageWithActionSpy.firstCall.args[1]).to.contain('Rerun');

      // check that API request is made again, with only valid repos
      expect(logSpy.lastCall.args[0]).to.contain('valid repositories: ["foo/bar","foo/baz"]');
      // test a few values in the octokit request
      expect(mockRequest.firstCall.args[1].data.language).to.eq('javascript');
      expect(mockRequest.firstCall.args[1].data.repositories).to.deep.eq(['foo/bar', 'foo/baz']);

    });

    function getMockCredentials(response: any) {
      mockRequest = sinon.stub().resolves(response);
      return {
        getOctokit: () => ({
          request: mockRequest
        })
      };
    }
  });

  describe('runRemoteQuery', () => {
    // TODO
  });
});
