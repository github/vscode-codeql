import { expect } from 'chai';
import * as path from 'path';
import { DbConfig } from '../../../src/databases/db-config';
import { DbConfigValidator } from '../../../src/databases/db-config-validator';

describe('db config validation', async () => {
  const extensionPath = path.join(__dirname, '../../..');
  const configValidator = new DbConfigValidator(extensionPath);

  it('should return error when file is not valid', async () => {
    // We're intentionally bypassing the type check because we'd
    // like to make sure validation errors are highlighted.
    const dbConfig = {
      'remote': {
        'repositoryLists': [
          {
            'name': 'repoList1',
            'repositories': ['foo/bar', 'foo/baz']
          }
        ],
        'repositories': ['owner/repo1', 'owner/repo2', 'owner/repo3'],
        'somethingElse': 'bar'
      }
    } as any as DbConfig;

    const validationOutput = configValidator.validate(dbConfig);

    expect(validationOutput).to.have.length(2);

    expect(validationOutput[0]).to.deep.equal('/remote must have required property \'owners\'');
    expect(validationOutput[1]).to.deep.equal('/remote must NOT have additional properties');
  });
});
