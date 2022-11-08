import * as sinon from 'sinon';
import * as pq from 'proxyquire';
import * as vscode from 'vscode';
import { DbConfig } from '../../../databases/db-config';
import { DbPanel } from '../../../databases/ui/db-panel';
import { DbManager } from '../../../databases/db-manager';
import { DbConfigStore } from '../../../databases/db-config-store';
import { CodeQLExtensionInterface } from '../../../extension';
import { DbTreeDataProvider } from '../../../databases/ui/db-tree-data-provider';

const proxyquire = pq.noPreserveCache();

describe('db panel', async () => {
  it('should work', async () => {
    // Create a db configuration file that includes remote repository lists, owners and single repos.
    const dbConfig: DbConfig = {
      remote: {
        repositoryLists: [
          {
            name: 'my-list-1',
            repositories: [
              'owner1/rep1',
              'owner2/repo2'
            ]
          },
        ],
        owners: [],
        repositories: []
      },
    };

    const extension = await vscode.extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
    const extensionContext = extension.ctx;



    // Get config file from workspace storage
    // const dbManager = new DbManager(dbConfgiStore);
    // const dbPanel = new DbPanel()
    // Load up the extension with the relevant flags to enable the new db panel using the above config.
    // Validate that the panel has the correct nodes rendered.

  });

  it('take 2', async () => {
    const dbConfig: DbConfig = {
      remote: {
        repositoryLists: [
          {
            name: 'my-list-1',
            repositories: [
              'owner1/rep1',
              'owner2/repo2'
            ]
          },
        ],
        owners: [],
        repositories: []
      },
    };

    // Define the workspace path
    const workspaceStoragePath = '..';

    // Set workspace config to dbConfig
    // ..

    const dbConfigStore = new DbConfigStore(workspaceStoragePath);
    const dbManager = new DbManager(dbConfigStore);

    // Spy on data provider
    const sandbox = sinon.createSandbox();

    const dbTreeDataProvider = new DbTreeDataProvider(dbManager);
    const dbProviderSpy = sandbox.spy(dbTreeDataProvider, 'getChildren');

    // Create am modified version of the db panel module
    // that allows us to pass in a spy for the data provider
    const mod = proxyquire('../../../databases/ui/db-panel', {
      'db-tree-data-provider': {
        DbTreeDataProvider: dbTreeDataProvider
      }
    });

    // Initialize the panel - this should create the tree view
    const dbPanel = new mod(dbManager);
    await dbPanel.initialize();

    // Check that the dbProviderSpy was called
    expect(dbProviderSpy.called).to.be.true;

  });
});
