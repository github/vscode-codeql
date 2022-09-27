import { SinonSandbox } from 'sinon';
import { Credentials } from '../../authentication';

export function createMockCredentials(sandbox: SinonSandbox, response = undefined) {
  let mockResponse: sinon.SinonStub<any, Promise<{ status: number }>>;

  const mockCredentials = {
    getOctokit: () => Promise.resolve({
      request: response || mockResponse
    })
  } as unknown as Credentials;

  sandbox.stub(Credentials, 'initialize').resolves(mockCredentials);
}
