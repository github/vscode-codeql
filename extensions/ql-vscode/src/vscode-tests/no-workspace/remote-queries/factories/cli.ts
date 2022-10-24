import { CodeQLCliServer } from '../../../../cli';

export function createMockCliServer(
  sandbox: sinon.SinonSandbox,
  mockOperations: Record<string, any[]> = {}
): CodeQLCliServer {
  if (mockOperations == {}) {
    mockOperations = {
      bqrsInfo: [{ 'result-sets': [{ name: 'result-set-1' }, { name: 'result-set-2' }] }],
      bqrsDecode: [{
        columns: [{ kind: 'NotString' }, { kind: 'String' }],
        tuples: [['a', 'b'], ['c', 'd']],
        next: 1
      }, {
        columns: [{ kind: 'String' }, { kind: 'NotString' }, { kind: 'StillNotString' }],
        tuples: [['a', 'b', 'c']]
      }]
    };
  }
  const mockServer: Record<string, any> = {};
  for (const [operation, returns] of Object.entries(mockOperations)) {
    mockServer[operation] = sandbox.stub();
    returns.forEach((returnValue, i) => {
      mockServer[operation].onCall(i).resolves(returnValue);
    });
  }

  return mockServer as unknown as CodeQLCliServer;
}
