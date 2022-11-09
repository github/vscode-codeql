import * as fs from 'fs-extra';
import * as path from 'path';
import { DbConfigStore } from '../../../src/databases/db-config-store';
import { expect } from 'chai';

describe('db config store', async () => {
  const extensionPath = path.join(__dirname, '../../..');
  const tempWorkspaceStoragePath = path.join(__dirname, 'test-workspace');
  const testDataStoragePath = path.join(__dirname, 'data');

  beforeEach(async () => {
    await fs.ensureDir(tempWorkspaceStoragePath);
  });

  afterEach(async () => {
    await fs.remove(tempWorkspaceStoragePath);
  });

  it('should create a new config if one does not exist', async () => {
    const configPath = path.join(tempWorkspaceStoragePath, 'workspace-databases.json');

    const configStore = new DbConfigStore(tempWorkspaceStoragePath, extensionPath);
    await configStore.initialize();

    expect(await fs.pathExists(configPath)).to.be.true;
    const config = configStore.getConfig();
    expect(config.remote.repositoryLists).to.be.empty;
    expect(config.remote.owners).to.be.empty;
    expect(config.remote.repositories).to.be.empty;
  });

  it('should load an existing config', async () => {
    const configStore = new DbConfigStore(testDataStoragePath, extensionPath);
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
    const configStore = new DbConfigStore(testDataStoragePath, extensionPath);
    await configStore.initialize();

    const config = configStore.getConfig();
    config.remote.repositoryLists = [];

    const reRetrievedConfig = configStore.getConfig();
    expect(reRetrievedConfig.remote.repositoryLists).to.have.length(1);
  });
});
