import { DisposableObject } from "../common/disposable-object";
import { App } from "../common/app";
import { findGitHubRepositoryForWorkspace } from "./github-repository-finder";
import { redactableError } from "../common/errors";
import { asError } from "../common/helpers-pure";

export class GithubDatabaseModule extends DisposableObject {
  private constructor(private readonly app: App) {
    super();
  }

  public static async initialize(app: App): Promise<GithubDatabaseModule> {
    const githubDatabaseModule = new GithubDatabaseModule(app);
    app.subscriptions.push(githubDatabaseModule);

    await githubDatabaseModule.initialize();
    return githubDatabaseModule;
  }

  private async initialize(): Promise<void> {
    // Start the check and downloading the database asynchronously. We don't want to block on this
    // in extension activation since this makes network requests and waits for user input.
    void this.promptGitHubRepositoryDownload().catch((e: unknown) => {
      const error = redactableError(
        asError(e),
      )`Failed to prompt for GitHub repository download`;

      void this.app.logger.log(error.fullMessageWithStack);
      this.app.telemetry?.sendError(error);
    });
  }

  private async promptGitHubRepositoryDownload(): Promise<void> {
    const githubRepositoryResult = await findGitHubRepositoryForWorkspace();
    if (githubRepositoryResult.isFailure) {
      void this.app.logger.log(
        `Did not find a GitHub repository for workspace: ${githubRepositoryResult.errors.join(
          ", ",
        )}`,
      );
      return;
    }

    const githubRepository = githubRepositoryResult.value;
    void this.app.logger.log(
      `Found GitHub repository for workspace: '${githubRepository.owner}/${githubRepository.name}'`,
    );
  }
}
