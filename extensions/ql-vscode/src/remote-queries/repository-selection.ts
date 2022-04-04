import { QuickPickItem, window } from 'vscode';
import { showAndLogErrorMessage } from '../helpers';
import { getRemoteRepositoryLists } from '../config';
import { logger } from '../logging';
import { REPO_REGEX } from '../pure/helpers-pure';

interface RepoListQuickPickItem extends QuickPickItem {
  repoList: string[];
}

/**
 * Gets the repositories to run the query against.
 */
export async function getRepositories(): Promise<string[] | undefined> {
  const repoLists = getRemoteRepositoryLists();
  if (repoLists && Object.keys(repoLists).length) {
    const quickPickItems = Object.entries(repoLists).map<RepoListQuickPickItem>(([key, value]) => (
      {
        label: key,       // the name of the repository list
        repoList: value,  // the actual array of repositories
      }
    ));
    const quickpick = await window.showQuickPick<RepoListQuickPickItem>(
      quickPickItems,
      {
        placeHolder: 'Select a repository list. You can define repository lists in the `codeQL.variantAnalysis.repositoryLists` setting.',
        ignoreFocusOut: true,
      });
    if (quickpick?.repoList.length) {
      void logger.log(`Selected repositories: ${quickpick.repoList.join(', ')}`);
      return quickpick.repoList;
    } else {
      void showAndLogErrorMessage('No repositories selected.');
      return;
    }
  } else {
    void logger.log('No repository lists defined. Displaying text input box.');
    const remoteRepo = await window.showInputBox({
      title: 'Enter a GitHub repository in the format <owner>/<repo> (e.g. github/codeql)',
      placeHolder: '<owner>/<repo>',
      prompt: 'Tip: you can save frequently used repositories in the `codeQL.variantAnalysis.repositoryLists` setting',
      ignoreFocusOut: true,
    });
    if (!remoteRepo) {
      void showAndLogErrorMessage('No repositories entered.');
      return;
    } else if (!REPO_REGEX.test(remoteRepo)) { // Check if user entered invalid input
      void showAndLogErrorMessage('Invalid repository format. Must be in the format <owner>/<repo> (e.g. github/codeql)');
      return;
    }
    void logger.log(`Entered repository: ${remoteRepo}`);
    return [remoteRepo];
  }
}
