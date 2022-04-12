import { expect } from 'chai';
import * as sinon from 'sinon';
import { Credentials } from '../../../authentication';
import { cancelRemoteQuery } from '../../../remote-queries/gh-actions-api-client';
import { RemoteQuery } from '../../../remote-queries/remote-query';

describe('gh-actions-api-client', () => {
  let sandbox: sinon.SinonSandbox;
  let mockCredentials: Credentials;
  let mockResponse: sinon.SinonStub<any, Promise<{ status: number }>>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockCredentials = {
      getOctokit: () => Promise.resolve({
        request: mockResponse
      })
    } as unknown as Credentials;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('cancelRemoteQuery', () => {
    it('should cancel a remote query', async () => {
      mockResponse = sinon.stub().resolves({ status: 202 });
      await cancelRemoteQuery(mockCredentials, createMockRemoteQuery());

      expect(mockResponse.calledOnce).to.be.true;
      expect(mockResponse.firstCall.args[0]).to.equal('POST /repos/github/codeql/actions/runs/123/cancel');
    });

    it('should fail to cancel a remote query', async () => {
      mockResponse = sinon.stub().resolves({ status: 409 });

      await expect(cancelRemoteQuery(mockCredentials, createMockRemoteQuery())).to.be.rejectedWith(/Error cancelling remote query/);
      expect(mockResponse.calledOnce).to.be.true;
      expect(mockResponse.firstCall.args[0]).to.equal('POST /repos/github/codeql/actions/runs/123/cancel');
    });

    function createMockRemoteQuery(): RemoteQuery {
      return {
        actionsWorkflowRunId: 123,
        controllerRepository: {
          owner: 'github',
          name: 'codeql'
        }
      } as unknown as RemoteQuery;
    }
  });
});
