import * as yaml from 'js-yaml';
import * as sinon from 'sinon';
import { KeyType } from '../../../contextual/keyType';
import { getErrorMessage } from '../../../pure/helpers-pure';

const proxyquire;

describe('queryResolver', () => {
  let module: Record<string, Function>;
  let writeFileSpy: sinon.SinonSpy;
  let getQlPackForDbschemeSpy: sinon.SinonStub;
  let getPrimaryDbschemeSpy: sinon.SinonStub;
  let mockCli: Record<string, sinon.SinonStub | Record<string, sinon.SinonStub>>;
  beforeEach(() => {
    mockCli = {
      resolveQueriesInSuite: jest.fn(),
      cliConstraints: {
        supportsAllowLibraryPacksInResolveQueries: jest.fn().mockReturnValue(true),
      }
    };
    module = createModule();
  });

  describe('resolveQueries', () => {
    it('should resolve a query', async () => {
      mockCli.resolveQueriesInSuite.returns(['a', 'b']);
      const result = await module.resolveQueries(mockCli, { dbschemePack: 'my-qlpack' }, KeyType.DefinitionQuery);
      expect(result).toEqual(['a', 'b']);
      expect(writeFileSpy.getCall(0).args[0]).toMatch(/.qls$/);
      expect(yaml.load(writeFileSpy.getCall(0).args[1])).toEqual([{
        from: 'my-qlpack',
        queries: '.',
        include: {
          kind: 'definitions',
          'tags contain': 'ide-contextual-queries/local-definitions'
        }
      }]);
    });

    it('should resolve a query from the queries pack if this is an old CLI', async () => {
      // pretend this is an older CLI
      (mockCli.cliConstraints as any).supportsAllowLibraryPacksInResolveQueries.returns(false);
      mockCli.resolveQueriesInSuite.returns(['a', 'b']);
      const result = await module.resolveQueries(mockCli, { dbschemePackIsLibraryPack: true, dbschemePack: 'my-qlpack', queryPack: 'my-qlpack2' }, KeyType.DefinitionQuery);
      expect(result).toEqual(['a', 'b']);
      expect(writeFileSpy.getCall(0).args[0]).toMatch(/.qls$/);
      expect(yaml.load(writeFileSpy.getCall(0).args[1])).toEqual([{
        from: 'my-qlpack2',
        queries: '.',
        include: {
          kind: 'definitions',
          'tags contain': 'ide-contextual-queries/local-definitions'
        }
      }]);
    });

    it('should throw an error when there are no queries found', async () => {
      mockCli.resolveQueriesInSuite.returns([]);

      try {
        await module.resolveQueries(mockCli, { dbschemePack: 'my-qlpack' }, KeyType.DefinitionQuery);
        // should reject
        expect(true).toBe(false);
      } catch (e) {
        expect(getErrorMessage(e)).toBe(
          'Couldn\'t find any queries tagged ide-contextual-queries/local-definitions in any of the following packs: my-qlpack.'
        );
      }
    });
  });

  describe('qlpackOfDatabase', () => {
    it('should get the qlpack of a database', async () => {
      getQlPackForDbschemeSpy.resolves('my-qlpack');
      const db = {
        contents: {
          datasetUri: {
            fsPath: '/path/to/database'
          }
        }
      };
      const result = await module.qlpackOfDatabase(mockCli, db);
      expect(result).toBe('my-qlpack');
      expect(getPrimaryDbschemeSpy).toBeCalledWith('/path/to/database');
    });
  });

  function createModule() {
    writeFileSpy = jest.fn();
    getQlPackForDbschemeSpy = jest.fn();
    getPrimaryDbschemeSpy = jest.fn();
    return proxyquire('../../../contextual/queryResolver', {
      'fs-extra': {
        writeFile: writeFileSpy
      },

      '../helpers': {
        getQlPackForDbscheme: getQlPackForDbschemeSpy,
        getPrimaryDbscheme: getPrimaryDbschemeSpy,
        getOnDiskWorkspaceFolders: () => ({}),
        showAndLogErrorMessage: () => ({})
      }
    });
  }
});
