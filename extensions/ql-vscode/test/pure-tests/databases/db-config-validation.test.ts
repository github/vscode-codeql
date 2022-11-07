import { validateDbConfig } from '../../../src/databases/db-config-validation';
import { DbConfig } from '../../../src/databases/db-config';

describe.only('db config validation', async () => {
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

    const validationOutput = validateDbConfig(dbConfig);

    expect(validationOutput).to.have.length(2);

    expect(validationOutput[0]).to.deep.equal('/remote must have required property \'owners\'');
    expect(validationOutput[1]).to.deep.equal('/remote must NOT have additional properties');
  });
});
