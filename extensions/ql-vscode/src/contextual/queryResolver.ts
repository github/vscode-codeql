import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as tmp from 'tmp-promise';

import * as helpers from '../helpers';
import {
  KeyType,
  kindOfKeyType,
  nameOfKeyType,
  tagOfKeyType
} from './keyType';
import { CodeQLCliServer } from '../cli';
import { DatabaseItem } from '../databases';

export async function qlpackOfDatabase(cli: CodeQLCliServer, db: DatabaseItem): Promise<string> {
  if (db.contents === undefined) {
    throw new Error('Database is invalid and cannot infer QLPack.');
  }
  const datasetPath = db.contents.datasetUri.fsPath;
  const dbscheme = await helpers.getPrimaryDbscheme(datasetPath);
  return await helpers.getQlPackForDbscheme(cli, dbscheme);
}


export async function resolveQueries(cli: CodeQLCliServer, qlpack: string, keyType: KeyType): Promise<string[]> {
  const suiteFile = (await tmp.file({
    postfix: '.qls'
  })).path;
  const suiteYaml = {
    qlpack,
    include: {
      kind: kindOfKeyType(keyType),
      'tags contain': tagOfKeyType(keyType)
    }
  };
  await fs.writeFile(suiteFile, yaml.safeDump(suiteYaml), 'utf8');

  const queries = await cli.resolveQueriesInSuite(suiteFile, helpers.getOnDiskWorkspaceFolders());
  if (queries.length === 0) {
    void helpers.showAndLogErrorMessage(
      `No ${nameOfKeyType(keyType)} queries (tagged "${tagOfKeyType(keyType)}") could be found in the current library path. \
      Try upgrading the CodeQL libraries. If that doesn't work, then ${nameOfKeyType(keyType)} queries are not yet available \
      for this language.`
    );
    throw new Error(`Couldn't find any queries tagged ${tagOfKeyType(keyType)} for qlpack ${qlpack}`);
  }
  return queries;
}
