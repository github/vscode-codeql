import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';

import { KeyType } from '../../../contextual/keyType';
import { getErrorMessage } from '../../../pure/helpers-pure';

import * as helpers from '../../../helpers';
import * as queryResolver from '../../../contextual/queryResolver';
import { CodeQLCliServer } from '../../../cli';
import { DatabaseItem } from '../../../databases';

describe('queryResolver', () => {
  const writeFileSpy = jest.spyOn(fs, 'writeFile').mockImplementation(() => Promise.resolve());

  const getQlPackForDbschemeSpy = jest.spyOn(helpers, 'getQlPackForDbscheme').mockResolvedValue({
    dbschemePack: 'dbschemePack',
    dbschemePackIsLibraryPack: false,
  });
  const getPrimaryDbschemeSpy = jest.spyOn(helpers, 'getPrimaryDbscheme').mockResolvedValue('primaryDbscheme');
  jest.spyOn(helpers, 'getOnDiskWorkspaceFolders').mockReturnValue([]);
  jest.spyOn(helpers, 'showAndLogErrorMessage').mockResolvedValue(undefined);

  let mockCli: Record<string, jest.MockedFunction<(...args: any[]) => any> | Record<string, jest.MockedFunction<(...args: any[]) => any>>>;
  beforeEach(() => {
    mockCli = {
      resolveQueriesInSuite: jest.fn(),
      cliConstraints: {
        supportsAllowLibraryPacksInResolveQueries: jest.fn().mockReturnValue(true),
      }
    };
  });

  describe('resolveQueries', () => {
    it('should resolve a query', async () => {
      mockCli.resolveQueriesInSuite.mockReturnValue(['a', 'b']);
      const result = await queryResolver.resolveQueries(mockCli as unknown as CodeQLCliServer, { dbschemePack: 'my-qlpack', dbschemePackIsLibraryPack: false }, KeyType.DefinitionQuery);
      expect(result).toEqual(['a', 'b']);
      expect(writeFileSpy.mock.calls[0][0]).toMatch(/.qls$/);
      expect(yaml.load(writeFileSpy.mock.calls[0][1] as string)).toEqual([{
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
      mockCli.resolveQueriesInSuite.mockReturnValue(['a', 'b']);
      const result = await queryResolver.resolveQueries(mockCli as unknown as CodeQLCliServer, { dbschemePackIsLibraryPack: true, dbschemePack: 'my-qlpack', queryPack: 'my-qlpack2' }, KeyType.DefinitionQuery);
      expect(result).toEqual(['a', 'b']);
      expect(writeFileSpy.mock.calls[0][0]).toMatch(/.qls$/);
      expect(yaml.load(writeFileSpy.mock.calls[0][1] as string)).toEqual([{
        from: 'my-qlpack2',
        queries: '.',
        include: {
          kind: 'definitions',
          'tags contain': 'ide-contextual-queries/local-definitions'
        }
      }]);
    });

    it('should throw an error when there are no queries found', async () => {
      mockCli.resolveQueriesInSuite.mockReturnValue([]);

      try {
        await queryResolver.resolveQueries(mockCli as unknown as CodeQLCliServer, { dbschemePack: 'my-qlpack', dbschemePackIsLibraryPack: false }, KeyType.DefinitionQuery);
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
      getQlPackForDbschemeSpy.mockResolvedValue({
        dbschemePack: 'my-qlpack',
        dbschemePackIsLibraryPack: false,
      });
      const db = {
        contents: {
          datasetUri: {
            fsPath: '/path/to/database'
          }
        }
      } as unknown as DatabaseItem;
      const result = await queryResolver.qlpackOfDatabase(mockCli as unknown as CodeQLCliServer, db);
      expect(result).toBe('my-qlpack');
      expect(getPrimaryDbschemeSpy).toBeCalledWith('/path/to/database');
    });
  });
});
