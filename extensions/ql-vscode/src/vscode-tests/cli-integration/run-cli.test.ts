import { expect } from 'chai';
import { extensions } from 'vscode';
import { SemVer } from 'semver';

import { CodeQLCliServer } from '../../cli';
import { CodeQLExtensionInterface } from '../../extension';
import { skipIfNoCodeQL } from '../ensureCli';
import { getOnDiskWorkspaceFolders } from '../../helpers';

/**
 * Perform proper integration tests by running the CLI
 */
describe('Use cli', function() {
  this.timeout(60000);

  let cli: CodeQLCliServer;

  beforeEach(async () => {
    const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
    if ('cliServer' in extension) {
      cli = extension.cliServer;
    } else {
      throw new Error('Extension not initialized. Make sure cli is downloaded and installed properly.');
    }
  });

  if (process.env.CLI_VERSION !== 'nightly') {
    it('should have the correct version of the cli', async () => {
      expect(
        (await cli.getVersion()).toString()
      ).to.eq(
        new SemVer(process.env.CLI_VERSION || '').toString()
      );
    });
  }

  it('should resolve ram', async () => {
    const result = await (cli as any).resolveRam(8192);
    expect(result).to.deep.eq([
      '-J-Xmx4096M',
      '--off-heap-ram=4096'
    ]);
  });

  it('should resolve query packs', async function() {
    skipIfNoCodeQL(this);
    const qlpacks = await cli.resolveQlpacks(getOnDiskWorkspaceFolders());
    // should have a bunch of qlpacks. just check that a few known ones exist
    expect(qlpacks['codeql-cpp']).not.to.be.undefined;
    expect(qlpacks['codeql-csharp']).not.to.be.undefined;
    expect(qlpacks['codeql-java']).not.to.be.undefined;
    expect(qlpacks['codeql-javascript']).not.to.be.undefined;
    expect(qlpacks['codeql-python']).not.to.be.undefined;
  });
});
