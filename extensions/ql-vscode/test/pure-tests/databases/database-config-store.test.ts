import * as fs from 'fs-extra';
import * as path from 'path';
import { DatabaseConfigStore } from '../../../src/databases/database-config-store';
import { expect } from 'chai';


describe('database config store', async () => {
  const workspaceStoragePath = path.join(__dirname, 'test-workspace');
  const testStoragePath = path.join(__dirname, 'data');

  beforeEach(async () => {
    await fs.ensureDir(workspaceStoragePath);
  });

  afterEach(async () => {
    await fs.remove(workspaceStoragePath);
  });

  it('should create a new config if one does not exist', async () => {
    const configPath = path.join(workspaceStoragePath, 'dbconfig.json');

    const configStore = new DatabaseConfigStore(workspaceStoragePath);
    await configStore.initialize();

    expect(await fs.pathExists(configPath)).to.be.true;
    const config = configStore.getConfig();
    expect(config.remote.repositoryLists).to.be.empty;
    expect(config.remote.owners).to.be.empty;
    expect(config.remote.repositories).to.be.empty;
  });

  it('should load an existing config', async () => {
    const configStore = new DatabaseConfigStore(testStoragePath);
    await configStore.initialize();

    const config = configStore.getConfig();
    expect(config.remote.repositoryLists).to.have.length(1);
    expect(config.remote.repositoryLists[0]).to.deep.equal({
      'name': 'repoList1',
      'repositories': ['foo/bar', 'foo/baz']
    });
    expect(config.remote.owners).to.be.empty;
    expect(config.remote.repositories).to.have.length(3);
    expect(config.remote.repositories).to.deep.equal(['owner/repo1', 'owner/repo2', 'owner/repo3']);
  });

  it('should not allow modification of the config', async () => {
    const configStore = new DatabaseConfigStore(testStoragePath);
    await configStore.initialize();

    const config = configStore.getConfig();
    config.remote.repositoryLists = [];

    const reRetrievedConfig = configStore.getConfig();
    expect(reRetrievedConfig.remote.repositoryLists).to.have.length(1);
  });
});
