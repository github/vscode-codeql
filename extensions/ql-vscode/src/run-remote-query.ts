import { Uri } from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs-extra';
import { showAndLogErrorMessage, showAndLogInformationMessage } from './helpers';
import { Credentials } from './authentication';

interface Config {
  repositories: string[];
  ref?: string;
  language: string;
}

// Test "controller" repository and workflow.
const OWNER = 'dsp-testing';
const REPO = 'qc-controller';

export default async function runRemoteQuery(credentials: Credentials, uri?: Uri) {
  if (!uri?.fsPath.endsWith('.ql')) {
    return;
  }

  const octokit = await credentials.getOctokit();
  const token = await credentials.getToken();

  const queryFile = uri.fsPath;
  const query = await fs.readFile(queryFile, 'utf8');

  const repositoriesFile = queryFile.substring(0, queryFile.length - '.ql'.length) + '.repositories';
  if (!(await fs.pathExists(repositoriesFile))) {
    void showAndLogErrorMessage(`Missing file: '${repositoriesFile}' to specify the repositories to run against. This file must be a sibling of ${queryFile}.`);
    return;
  }

  const config = yaml.safeLoad(await fs.readFile(repositoriesFile, 'utf8')) as Config;

  const ref = config.ref || 'main';
  const language = config.language;
  const repositories = config.repositories;

  try {
    await octokit.request(
      'POST /repos/:owner/:repo/code-scanning/codeql/queries',
      {
        owner: OWNER,
        repo: REPO,
        data: {
          ref: ref,
          language: language,
          repositories: repositories,
          query: query,
          token: token,
        }
      }
    );
    void showAndLogInformationMessage(`Successfully scheduled runs. [Click here to see the progress](https://github.com/${OWNER}/${REPO}/actions).`);

  } catch (error) {
    void showAndLogErrorMessage(error);
  }
}
