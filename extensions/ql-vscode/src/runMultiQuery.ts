import { Uri, workspace } from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import * as path from 'path';
import fetch from 'node-fetch';
import { showAndLogErrorMessage, showAndLogInformationMessage } from './helpers';
import { PERSONAL_ACCESS_TOKEN_SETTING } from './config';

// const BASE_URL = 'https://api.github.com/repos/dsp-testing/multi-repo-queries/actions/workflows/run-multi-query.yml/dispatches';
const API_URL = 'https://cbraynor-3be288ce6.service.bpdev-us-east-1.github.net/api/v3/repos/hackathon/run-queries/actions/workflows/run-multi-query.yml/dispatches';
const VIEW_URL_BASE = 'https://cbraynor-3be288ce6.service.bpdev-us-east-1.github.net/hackathon/run-queries/';


interface Config {
  repositories: string[];
  ref?: string;
  language: string;
  bundle: boolean;
}

export default async function runMultiQuery(uri?: Uri) {
  if (!uri || !uri.fsPath.endsWith('.ql')) {
    return;
  }

  const token = PERSONAL_ACCESS_TOKEN_SETTING.getValue();
  if (!token) {
    showAndLogErrorMessage('Missing PAT for dispatching the actions run. Add a "codeQL.cli.personalAccessToken" user setting with your PAT in it.');
    return;
  }

  const queryFile = uri.fsPath;
  const query = await fs.readFile(queryFile, 'utf8');

  const repositoriesFile = queryFile.substring(0, queryFile.length - '.ql'.length) + '.repositories';
  if (!(await fs.pathExists(repositoriesFile))) {
    showAndLogErrorMessage(`Missing file: '${repositoriesFile}' to specify the repositories to run against.`);
    return;
  }

  const config = yaml.safeLoad(await fs.readFile(repositoriesFile, 'utf8')) as Config;

  const ref = config.ref || 'main';
  const language = config.language;
  const bundleDatabase = config.bundle || false;
  const repositories = JSON.stringify(config.repositories);
  const queryRunGuid = `${path.basename(queryFile)}-${Date.now()}`;

  const apiUrl = workspace.getConfiguration('codeQL.cli').get('multiQueryBaseUrl', API_URL);
  const viewUrl = workspace.getConfiguration('codeQL.cli').get('multiQueryViewUrl', VIEW_URL_BASE);

  const result = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `token ${token}`
    },
    body: JSON.stringify({
      ref,
      inputs: {
        language,
        repositories,
        query,
        'query_run_guid': queryRunGuid,
        ...(
          // Avoid sending this key if it is false since the server may not support this input
          bundleDatabase
           ? { 'bundle_database': String(bundleDatabase) }
           : {}
        )
      }
    })
  });

  if (result.ok) {
    showAndLogInformationMessage(`Successfully scheduled runs. [Check it out here](${viewUrl}/security/code-scanning?query=tool%3A${queryRunGuid})`);
  } else {
    showAndLogErrorMessage(`Failed to schedule run: ${result.status} ${result.statusText}`);
  }
}
