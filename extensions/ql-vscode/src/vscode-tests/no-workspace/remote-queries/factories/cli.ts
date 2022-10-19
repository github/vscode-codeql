import { CodeQLCliServer } from '../../../../cli';

export function createMockCliServer(mockOperations: Record<string, any[]>, sandbox: sinon.SinonSandbox): CodeQLCliServer {
  const mockServer: Record<string, any> = {};
  for (const [operation, returns] of Object.entries(mockOperations)) {
    mockServer[operation] = sandbox.stub();
    returns.forEach((returnValue, i) => {
      mockServer[operation].onCall(i).resolves(returnValue);
    });
  }

  return mockServer as unknown as CodeQLCliServer;
}
