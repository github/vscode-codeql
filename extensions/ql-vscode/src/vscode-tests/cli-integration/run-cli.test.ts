import { expect } from 'chai';
import { extensions } from 'vscode';
import { SemVer } from 'semver';

import { CodeQLCliServer } from '../../cli';
import { CodeQLExtensionInterface } from '../../extension';


/**
 * Perform proper integration tests by running the CLI
 */
describe('Use cli', function() {
  this.timeout(60000);

  let cli: CodeQLCliServer;

  beforeEach(async () => {
    const extension = await extensions.getExtension<CodeQLExtensionInterface | {}>('GitHub.vscode-codeql')!.activate();
    if ('cliServer' in extension) {
      cli = extension.cliServer;
    } else {
      throw new Error('Extension not initialized. Make sure cli is downloaded and installed properly.');
    }
  });

  afterEach(() => {
    cli.dispose();
  });

  it('should have the correct version of the cli', async () => {
    expect(
      (await cli.getVersion()).toString()
    ).to.eq(
      new SemVer(process.env.CLI_VERSION || '').toString()
    );
  });

  it('should resolve ram', async () => {
    const result = await (cli as any).resolveRam(8192);
    expect(result).to.deep.eq([
      '-J-Xmx4096M',
      '--off-heap-ram=4096'
    ]);
  });
});
