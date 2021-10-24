import { assert, expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { CancellationToken, extensions, QuickPickItem, Uri, window } from 'vscode';
import 'mocha';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';

import { runRemoteQuery } from '../../run-remote-query';
import { Credentials } from '../../authentication';
import { CodeQLCliServer } from '../../cli';
import { CodeQLExtensionInterface } from '../../extension';
import { setRemoteControllerRepo } from '../../config';
import { UserCancellationException } from '../../commandRunner';

describe('Remote queries', function() {
  const baseDir = path.join(__dirname, '../../../src/vscode-tests/cli-integration');

  let sandbox: sinon.SinonSandbox;

  // up to 3 minutes per test
  this.timeout(3 * 60 * 1000);

  let cli: CodeQLCliServer;
  let credentials: Credentials = {} as unknown as Credentials;
  let token: CancellationToken;
  let progress: sinon.SinonSpy;
  let showQuickPickSpy: sinon.SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
    if ('cliServer' in extension) {
      cli = extension.cliServer;
    } else {
      throw new Error('Extension not initialized. Make sure cli is downloaded and installed properly.');
    }
    credentials = {} as unknown as Credentials;
    token = {
      isCancellationRequested: false
    } as unknown as CancellationToken;

    progress = sandbox.spy();
    // Should not have asked for a language
    showQuickPickSpy = sandbox.stub(window, 'showQuickPick')
      .onFirstCall().resolves({ repoList: ['github/vscode-codeql'] } as unknown as QuickPickItem)
      .onSecondCall().resolves('javascript' as unknown as QuickPickItem);

    // always run in the vscode-codeql repo
    void setRemoteControllerRepo('github/vscode-codeql');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should run a remote query that is part of a qlpack', async () => {
    const fileUri = getFile('data-remote-qlpack/in-pack.ql');

    const queryPackRootDir = (await runRemoteQuery(cli, credentials, fileUri, true, progress, token))!;

    // to retrieve the list of repositories
    expect(showQuickPickSpy).to.have.been.calledOnce;

    // check a few files that we know should exist and others that we know should not

    // the tarball to deliver to the server
    expect(fs.readdirSync(queryPackRootDir).find(f => f.startsWith('qlpack-') && f.endsWith('-generated.tgz'))).not.to.be.undefined;

    const queryPackDir = path.join(queryPackRootDir, 'query-pack');
    // in-pack.ql renamed to query.ql
    expect(fs.existsSync(path.join(queryPackDir, 'query.ql'))).to.be.true;
    expect(fs.existsSync(path.join(queryPackDir, 'lib.qll'))).to.be.true;
    expect(fs.existsSync(path.join(queryPackDir, 'qlpack.yml'))).to.be.true;
    expect(fs.existsSync(
      // depending on the cli version, we should have one of these files
      path.join(queryPackDir, 'qlpack.lock.yml') || path.join(queryPackDir, 'codeql-pack.lock.yml')
    )).to.be.true;
    expect(fs.existsSync(path.join(queryPackDir, 'not-in-pack.ql'))).to.be.false;

    // the compiled pack
    const compiledPackDir = path.join(queryPackDir, '.codeql/pack/github/remote-query-pack/0.0.0/');
    expect(fs.existsSync(path.join(compiledPackDir, 'query.ql'))).to.be.true;
    expect(fs.existsSync(path.join(compiledPackDir, 'lib.qll'))).to.be.true;
    expect(fs.existsSync(path.join(compiledPackDir, 'qlpack.yml'))).to.be.true;
    expect(fs.existsSync(
      // depending on the cli version, we should have one of these files
      path.join(compiledPackDir, 'qlpack.lock.yml') || path.join(queryPackDir, 'codeql-pack.lock.yml')
    )).to.be.true;
    expect(fs.existsSync(path.join(compiledPackDir, 'not-in-pack.ql'))).to.be.false;

    // dependencies
    const libraryDir = path.join(compiledPackDir, '.codeql/libraries/codeql');
    const packNames = fs.readdirSync(libraryDir).sort();
    expect(packNames).to.deep.equal(['javascript-all', 'javascript-upgrades']);
  });

  it('should run a remote query that is not part of a qlpack', async () => {
    const fileUri = getFile('data-remote-no-qlpack/in-pack.ql');

    const queryPackRootDir = (await runRemoteQuery(cli, credentials, fileUri, true, progress, token))!;

    // to retrieve the list of repositories
    // and a second time to ask for the language
    expect(showQuickPickSpy).to.have.been.calledTwice;

    // check a few files that we know should exist and others that we know should not

    // the tarball to deliver to the server
    expect(fs.readdirSync(queryPackRootDir).find(f => f.startsWith('qlpack-') && f.endsWith('-generated.tgz'))).not.to.be.undefined;

    const queryPackDir = path.join(queryPackRootDir, 'query-pack');
    // in-pack.ql renamed to query.ql
    expect(fs.existsSync(path.join(queryPackDir, 'query.ql'))).to.be.true;
    expect(fs.existsSync(path.join(queryPackDir, 'qlpack.yml'))).to.be.true;
    expect(fs.existsSync(
      // depending on the cli version, we should have one of these files
      path.join(queryPackDir, 'qlpack.lock.yml') || path.join(queryPackDir, 'codeql-pack.lock.yml')
    )).to.be.true;
    expect(fs.existsSync(path.join(queryPackDir, 'lib.qll'))).to.be.false;
    expect(fs.existsSync(path.join(queryPackDir, 'not-in-pack.ql'))).to.be.false;

    // the compiled pack
    const compiledPackDir = path.join(queryPackDir, '.codeql/pack/codeql-remote/query/1.0.0/');
    expect(fs.existsSync(path.join(compiledPackDir, 'query.ql'))).to.be.true;
    expect(fs.existsSync(path.join(compiledPackDir, 'qlpack.yml'))).to.be.true;
    expect(fs.existsSync(
      // depending on the cli version, we should have one of these files
      path.join(compiledPackDir, 'qlpack.lock.yml') || path.join(queryPackDir, 'codeql-pack.lock.yml')
    )).to.be.true;
    expect(fs.existsSync(path.join(compiledPackDir, 'lib.qll'))).to.be.false;
    expect(fs.existsSync(path.join(compiledPackDir, 'not-in-pack.ql'))).to.be.false;
    // should have generated a correct qlpack file
    const qlpackContents: any = yaml.safeLoad(fs.readFileSync(path.join(compiledPackDir, 'qlpack.yml'), 'utf8'));
    expect(qlpackContents.name).to.equal('codeql-remote/query');
    expect(qlpackContents.version).to.equal('1.0.0');
    expect(qlpackContents.dependencies?.['codeql/javascript-all']).to.equal('*');

    // dependencies
    const libraryDir = path.join(compiledPackDir, '.codeql/libraries/codeql');
    const packNames = fs.readdirSync(libraryDir).sort();
    expect(packNames).to.deep.equal(['javascript-all', 'javascript-upgrades']);
  });

  it('should cancel a run before uploading', async () => {
    const fileUri = getFile('data-remote-no-qlpack/in-pack.ql');

    const promise = runRemoteQuery(cli, credentials, fileUri, true, progress, token);

    token.isCancellationRequested = true;

    try {
      await promise;
      assert.fail('should have thrown');
    } catch (e) {
      expect(e).to.be.instanceof(UserCancellationException);
    }
  });

  function getFile(file: string): Uri {
    return Uri.file(path.join(baseDir, file));
  }
});
