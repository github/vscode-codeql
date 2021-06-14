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

export default async function runRemoteQuery(credentials: Credentials, uri?: Uri) {
  if (!uri || !uri.fsPath.endsWith('.ql')) {
    return;
  }

  const octokit = await credentials.getOctokit();
  const token = await credentials.getToken();

  const queryFile = uri.fsPath;
  const query = await fs.readFile(queryFile, 'utf8');

  const repositoriesFile = queryFile.substring(0, queryFile.length - '.ql'.length) + '.repositories';
  if (!(await fs.pathExists(repositoriesFile))) {
    void showAndLogErrorMessage(`Missing file: '${repositoriesFile}' to specify the repositories to run against.`);
    return;
  }

  const config = yaml.safeLoad(await fs.readFile(repositoriesFile, 'utf8')) as Config;

  const ref = config.ref || 'main';
  const language = config.language;
  const repositories = JSON.stringify(config.repositories);

  // Test "controller" repository and workflow.
  const owner = 'dsp-testing';
  const repo = 'qc-controller';
  const workflow_id = 'codeql-query.yml';

  try {
    await octokit.rest.actions.createWorkflowDispatch({
      owner: owner,
      repo: repo,
      workflow_id: workflow_id,
      ref: ref,
      inputs: {
        language,
        repositories,
        query,
        token
      }
    });
    void showAndLogInformationMessage(`Successfully scheduled runs. [Click here to see the progress](https://github.com/${owner}/${repo}/actions).`);

  } catch (error) {
    void showAndLogErrorMessage(error);
  }
}
