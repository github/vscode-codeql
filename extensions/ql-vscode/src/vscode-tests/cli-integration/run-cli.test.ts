import { expect } from 'chai';
import { extensions, Uri } from 'vscode';
import * as path from 'path';
import { SemVer } from 'semver';

import { CodeQLCliServer, QueryInfoByLanguage } from '../../cli';
import { CodeQLExtensionInterface } from '../../extension';
import { skipIfNoCodeQL } from '../ensureCli';
import { getOnDiskWorkspaceFolders, getQlPackForDbscheme, languageToDbScheme } from '../../helpers';
import { resolveQueries } from '../../contextual/queryResolver';
import { KeyType } from '../../contextual/keyType';

/**
 * Perform proper integration tests by running the CLI
 */
describe('Use cli', function() {
  const supportedLanguages = ['cpp', 'csharp', 'go', 'java', 'javascript', 'python'];

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

  if (process.env.CLI_VERSION && process.env.CLI_VERSION !== 'nightly') {
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
    // Depending on the version of the CLI, the qlpacks may have different names
    // (e.g. "codeql/javascript-all" vs "codeql-javascript"),
    // so we just check that the expected languages are included.
    for (const expectedLanguage of supportedLanguages) {
      expect((Object.keys(qlpacks)).includes(expectedLanguage));
    }
  });

  it('should resolve languages', async function() {
    skipIfNoCodeQL(this);
    const languages = await cli.resolveLanguages();
    for (const expectedLanguage of supportedLanguages) {
      expect(languages).to.have.property(expectedLanguage).that.is.not.undefined;
    }
  });

  it('should resolve query by language', async function() {
    skipIfNoCodeQL(this);
    const queryPath = path.join(__dirname, 'data', 'simple-javascript-query.ql');
    const queryInfo: QueryInfoByLanguage = await cli.resolveQueryByLanguage(getOnDiskWorkspaceFolders(), Uri.file(queryPath));
    expect((Object.keys(queryInfo.byLanguage))[0]).to.eql('javascript');
  });


  supportedLanguages.forEach(lang => {
    if (lang === 'go') {
      // The codeql-go submodule is not available in the integration tests.
      return;
    }
    it(`should resolve printAST queries for ${lang}`, async function() {
      skipIfNoCodeQL(this);

      const pack = await getQlPackForDbscheme(cli, languageToDbScheme[lang]);
      expect(pack.dbschemePack).to.contain(lang);
      if (pack.dbschemePackIsLibraryPack) {
        expect(pack.queryPack).to.contain(lang);
      }

      const result = await resolveQueries(cli, pack, KeyType.PrintAstQuery);

      // It doesn't matter what the name or path of the query is, only
      // that we have found exactly one query.
      expect(result.length).to.eq(1);
    });
  });
});
