import { assert, expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { CancellationToken, extensions, QuickPickItem, Uri, window } from 'vscode';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as yaml from 'js-yaml';

import { QlPack, runRemoteQuery } from '../../../remote-queries/run-remote-query';
import { Credentials } from '../../../authentication';
import { CliVersionConstraint, CodeQLCliServer } from '../../../cli';
import { CodeQLExtensionInterface } from '../../../extension';
import { setRemoteControllerRepo, setRemoteRepositoryLists } from '../../../config';
import { UserCancellationException } from '../../../commandRunner';
import { lte } from 'semver';

describe('Remote queries', () => {
  const baseDir = path.join(__dirname, '../../../../src/vscode-tests/cli-integration');

  let sandbox: sinon.SinonSandbox;

  // up to 3 minutes per test
  this.timeout(3 * 60 * 1000);

  let cli: CodeQLCliServer;
  let credentials: Credentials = {} as unknown as Credentials;
  let token: CancellationToken;
  let progress: sinon.SinonSpy;
  let showQuickPickSpy: sinon.SinonStub;

  // use `function` so we have access to `this`
  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
    if ('cliServer' in extension) {
      cli = extension.cliServer;
    } else {
      throw new Error('Extension not initialized. Make sure cli is downloaded and installed properly.');
    }

    if (!(await cli.cliConstraints.supportsRemoteQueries())) {
      console.log(`Remote queries are not supported on CodeQL CLI v${CliVersionConstraint.CLI_VERSION_REMOTE_QUERIES
        }. Skipping this test.`);
      this.skip();
    }
    credentials = {} as unknown as Credentials;
    token = {
      isCancellationRequested: false
    } as unknown as CancellationToken;

    progress = sandbox.spy();
    // Should not have asked for a language
    showQuickPickSpy = sandbox.stub(window, 'showQuickPick')
      .onFirstCall().resolves({ repositories: ['github/vscode-codeql'] } as unknown as QuickPickItem)
      .onSecondCall().resolves('javascript' as unknown as QuickPickItem);

    // always run in the vscode-codeql repo
    await setRemoteControllerRepo('github/vscode-codeql');
    await setRemoteRepositoryLists({ 'vscode-codeql': ['github/vscode-codeql'] });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should run a remote query that is part of a qlpack', async () => {
    const fileUri = getFile('data-remote-qlpack/in-pack.ql');

    const querySubmissionResult = await runRemoteQuery(cli, credentials, fileUri, true, progress, token);
    expect(querySubmissionResult).toBeTruthy();
    const queryPackRootDir = querySubmissionResult!.queryDirPath!;
    printDirectoryContents(queryPackRootDir);

    // to retrieve the list of repositories
    expect(showQuickPickSpy).toBeCalledTimes(1);

    // check a few files that we know should exist and others that we know should not

    // the tarball to deliver to the server
    expect(fs.readdirSync(queryPackRootDir).find(f => f.startsWith('qlpack-') && f.endsWith('-generated.tgz'))).toBeDefined();

    const queryPackDir = path.join(queryPackRootDir, 'query-pack');
    printDirectoryContents(queryPackDir);

    expect(fs.existsSync(path.join(queryPackDir, 'in-pack.ql'))).toBe(true);
    expect(fs.existsSync(path.join(queryPackDir, 'lib.qll'))).toBe(true);
    expect(fs.existsSync(path.join(queryPackDir, 'qlpack.yml'))).toBe(true);

    // depending on the cli version, we should have one of these files
    expect(
      fs.existsSync(path.join(queryPackDir, 'qlpack.lock.yml')) ||
      fs.existsSync(path.join(queryPackDir, 'codeql-pack.lock.yml'))
    ).toBe(true);
    expect(fs.existsSync(path.join(queryPackDir, 'not-in-pack.ql'))).toBe(false);

    // the compiled pack
    const compiledPackDir = path.join(queryPackDir, '.codeql/pack/codeql-remote/query/0.0.0/');
    printDirectoryContents(compiledPackDir);

    expect(fs.existsSync(path.join(compiledPackDir, 'in-pack.ql'))).toBe(true);
    expect(fs.existsSync(path.join(compiledPackDir, 'lib.qll'))).toBe(true);
    expect(fs.existsSync(path.join(compiledPackDir, 'qlpack.yml'))).toBe(true);
    // should have generated a correct qlpack file
    const qlpackContents: any = yaml.load(fs.readFileSync(path.join(compiledPackDir, 'qlpack.yml'), 'utf8'));
    expect(qlpackContents.name).toBe('codeql-remote/query');

    // depending on the cli version, we should have one of these files
    expect(
      fs.existsSync(path.join(compiledPackDir, 'qlpack.lock.yml')) ||
      fs.existsSync(path.join(compiledPackDir, 'codeql-pack.lock.yml'))
    ).toBe(true);
    expect(fs.existsSync(path.join(compiledPackDir, 'not-in-pack.ql'))).toBe(false);
    verifyQlPack(path.join(compiledPackDir, 'qlpack.yml'), 'in-pack.ql', '0.0.0', await pathSerializationBroken());

    const libraryDir = path.join(compiledPackDir, '.codeql/libraries/codeql');
    const packNames = fs.readdirSync(libraryDir).sort();

    // check dependencies.
    // 2.7.4 and earlier have ['javascript-all', 'javascript-upgrades']
    // later only have ['javascript-all']. ensure this test can handle either
    expect(packNames.length).toBeLessThan(3).toBeGreaterThan(0);
    expect(packNames[0]).toEqual('javascript-all');
  });

  it('should run a remote query that is not part of a qlpack', async () => {
    const fileUri = getFile('data-remote-no-qlpack/in-pack.ql');

    const querySubmissionResult = await runRemoteQuery(cli, credentials, fileUri, true, progress, token);
    expect(querySubmissionResult).toBeTruthy();
    const queryPackRootDir = querySubmissionResult!.queryDirPath!;

    // to retrieve the list of repositories
    // and a second time to ask for the language
    expect(showQuickPickSpy).toBeCalledTimes(2);

    // check a few files that we know should exist and others that we know should not

    // the tarball to deliver to the server
    printDirectoryContents(queryPackRootDir);
    expect(fs.readdirSync(queryPackRootDir).find(f => f.startsWith('qlpack-') && f.endsWith('-generated.tgz'))).toBeDefined();

    const queryPackDir = path.join(queryPackRootDir, 'query-pack');
    printDirectoryContents(queryPackDir);

    expect(fs.existsSync(path.join(queryPackDir, 'in-pack.ql'))).toBe(true);
    expect(fs.existsSync(path.join(queryPackDir, 'qlpack.yml'))).toBe(true);
    // depending on the cli version, we should have one of these files
    expect(
      fs.existsSync(path.join(queryPackDir, 'qlpack.lock.yml')) ||
      fs.existsSync(path.join(queryPackDir, 'codeql-pack.lock.yml'))
    ).toBe(true);
    expect(fs.existsSync(path.join(queryPackDir, 'lib.qll'))).toBe(false);
    expect(fs.existsSync(path.join(queryPackDir, 'not-in-pack.ql'))).toBe(false);

    // the compiled pack
    const compiledPackDir = path.join(queryPackDir, '.codeql/pack/codeql-remote/query/0.0.0/');
    printDirectoryContents(compiledPackDir);
    expect(fs.existsSync(path.join(compiledPackDir, 'in-pack.ql'))).toBe(true);
    expect(fs.existsSync(path.join(compiledPackDir, 'qlpack.yml'))).toBe(true);
    verifyQlPack(path.join(compiledPackDir, 'qlpack.yml'), 'in-pack.ql', '0.0.0', await pathSerializationBroken());

    // depending on the cli version, we should have one of these files
    expect(
      fs.existsSync(path.join(compiledPackDir, 'qlpack.lock.yml')) ||
      fs.existsSync(path.join(compiledPackDir, 'codeql-pack.lock.yml'))
    ).toBe(true);
    expect(fs.existsSync(path.join(compiledPackDir, 'lib.qll'))).toBe(false);
    expect(fs.existsSync(path.join(compiledPackDir, 'not-in-pack.ql'))).toBe(false);
    // should have generated a correct qlpack file
    const qlpackContents: any = yaml.load(fs.readFileSync(path.join(compiledPackDir, 'qlpack.yml'), 'utf8'));
    expect(qlpackContents.name).toBe('codeql-remote/query');
    expect(qlpackContents.version).toBe('0.0.0');
    expect(qlpackContents.dependencies?.['codeql/javascript-all']).toBe('*');

    const libraryDir = path.join(compiledPackDir, '.codeql/libraries/codeql');
    printDirectoryContents(libraryDir);
    const packNames = fs.readdirSync(libraryDir).sort();

    // check dependencies.
    // 2.7.4 and earlier have ['javascript-all', 'javascript-upgrades']
    // later only have ['javascript-all']. ensure this test can handle either
    expect(packNames.length).toBeLessThan(3).toBeGreaterThan(0);
    expect(packNames[0]).toEqual('javascript-all');
  });

  it('should run a remote query that is nested inside a qlpack', async () => {
    const fileUri = getFile('data-remote-qlpack-nested/subfolder/in-pack.ql');

    const querySubmissionResult = await runRemoteQuery(cli, credentials, fileUri, true, progress, token);
    expect(querySubmissionResult).toBeTruthy();
    const queryPackRootDir = querySubmissionResult!.queryDirPath!;

    // to retrieve the list of repositories
    expect(showQuickPickSpy).toBeCalledTimes(1);

    // check a few files that we know should exist and others that we know should not

    // the tarball to deliver to the server
    printDirectoryContents(queryPackRootDir);
    expect(fs.readdirSync(queryPackRootDir).find(f => f.startsWith('qlpack-') && f.endsWith('-generated.tgz'))).toBeDefined();

    const queryPackDir = path.join(queryPackRootDir, 'query-pack');
    printDirectoryContents(queryPackDir);

    expect(fs.existsSync(path.join(queryPackDir, 'subfolder/in-pack.ql'))).toBe(true);
    expect(fs.existsSync(path.join(queryPackDir, 'qlpack.yml'))).toBe(true);
    // depending on the cli version, we should have one of these files
    expect(
      fs.existsSync(path.join(queryPackDir, 'qlpack.lock.yml')) ||
      fs.existsSync(path.join(queryPackDir, 'codeql-pack.lock.yml'))
    ).toBe(true);
    expect(fs.existsSync(path.join(queryPackDir, 'otherfolder/lib.qll'))).toBe(true);
    expect(fs.existsSync(path.join(queryPackDir, 'not-in-pack.ql'))).toBe(false);

    // the compiled pack
    const compiledPackDir = path.join(queryPackDir, '.codeql/pack/codeql-remote/query/0.0.0/');
    printDirectoryContents(compiledPackDir);
    expect(fs.existsSync(path.join(compiledPackDir, 'otherfolder/lib.qll'))).toBe(true);
    expect(fs.existsSync(path.join(compiledPackDir, 'subfolder/in-pack.ql'))).toBe(true);
    expect(fs.existsSync(path.join(compiledPackDir, 'qlpack.yml'))).toBe(true);
    verifyQlPack(path.join(compiledPackDir, 'qlpack.yml'), 'subfolder/in-pack.ql', '0.0.0', await pathSerializationBroken());

    // depending on the cli version, we should have one of these files
    expect(
      fs.existsSync(path.join(compiledPackDir, 'qlpack.lock.yml')) ||
      fs.existsSync(path.join(compiledPackDir, 'codeql-pack.lock.yml'))
    ).toBe(true);
    expect(fs.existsSync(path.join(compiledPackDir, 'not-in-pack.ql'))).toBe(false);
    // should have generated a correct qlpack file
    const qlpackContents: any = yaml.load(fs.readFileSync(path.join(compiledPackDir, 'qlpack.yml'), 'utf8'));
    expect(qlpackContents.name).toBe('codeql-remote/query');
    expect(qlpackContents.version).toBe('0.0.0');
    expect(qlpackContents.dependencies?.['codeql/javascript-all']).toBe('*');

    const libraryDir = path.join(compiledPackDir, '.codeql/libraries/codeql');
    printDirectoryContents(libraryDir);
    const packNames = fs.readdirSync(libraryDir).sort();

    // check dependencies.
    // 2.7.4 and earlier have ['javascript-all', 'javascript-upgrades']
    // later only have ['javascript-all']. ensure this test can handle either
    expect(packNames.length).toBeLessThan(3).toBeGreaterThan(0);
    expect(packNames[0]).toEqual('javascript-all');
  });

  it('should cancel a run before uploading', async () => {
    const fileUri = getFile('data-remote-no-qlpack/in-pack.ql');

    const promise = runRemoteQuery(cli, credentials, fileUri, true, progress, token);

    token.isCancellationRequested = true;

    try {
      await promise;
      assert.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(UserCancellationException);
    }
  });

  function verifyQlPack(qlpackPath: string, queryPath: string, packVersion: string, pathSerializationBroken: boolean) {
    const qlPack = yaml.load(fs.readFileSync(qlpackPath, 'utf8')) as QlPack;

    if (pathSerializationBroken) {
      // the path serialization is broken, so we force it to be the path in the pack to be same as the query path
      qlPack.defaultSuite![1].query = queryPath;
    }

    // don't check the build metadata since it is variable
    delete (qlPack as any).buildMetadata;

    expect(qlPack).toEqual({
      name: 'codeql-remote/query',
      version: packVersion,
      dependencies: {
        'codeql/javascript-all': '*',
      },
      library: false,
      defaultSuite: [{
        description: 'Query suite for variant analysis'
      }, {
        query: queryPath
      }]
    });
  }

  /**
   * In version 2.7.2 and earlier, relative paths were not serialized correctly inside the qlpack.yml file.
   * So, ignore part of the test for these versions.
   *
   * @returns true if path serialization is broken in this run
   */
  async function pathSerializationBroken() {
    return lte((await cli.getVersion()), '2.7.2') && os.platform() === 'win32';
  }
  function getFile(file: string): Uri {
    return Uri.file(path.join(baseDir, file));
  }

  function printDirectoryContents(dir: string) {
    console.log(`DIR ${dir}`);
    if (!fs.existsSync(dir)) {
      console.log(`DIR ${dir} does not exist`);
    }
    fs.readdirSync(dir).sort().forEach(f => console.log(`  ${f}`));
  }
});
