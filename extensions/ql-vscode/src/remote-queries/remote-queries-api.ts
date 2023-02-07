import { EOL } from "os";
import { Credentials } from "../common/authentication";
import { RepositorySelection } from "./repository-selection";
import { Repository } from "./shared/repository";
import { RemoteQueriesResponse } from "./gh-api/remote-queries";
import { submitRemoteQueries } from "./gh-api/gh-api-client";
import {
  showAndLogErrorMessage,
  showAndLogExceptionWithTelemetry,
  showAndLogInformationMessage,
} from "../helpers";
import { asError, getErrorMessage } from "../pure/helpers-pure";
import { pluralize } from "../pure/word";
import { redactableError } from "../pure/errors";

export async function runRemoteQueriesApiRequest(
  credentials: Credentials,
  ref: string,
  language: string,
  repoSelection: RepositorySelection,
  controllerRepo: Repository,
  queryPackBase64: string,
): Promise<void | RemoteQueriesResponse> {
  try {
    const response = await submitRemoteQueries(credentials, {
      ref,
      language,
      repositories: repoSelection.repositories,
      repositoryLists: repoSelection.repositoryLists,
      repositoryOwners: repoSelection.owners,
      queryPack: queryPackBase64,
      controllerRepoId: controllerRepo.id,
    });
    const { popupMessage, logMessage } = parseResponse(
      controllerRepo,
      response,
    );
    void showAndLogInformationMessage(popupMessage, {
      fullMessage: logMessage,
    });
    return response;
  } catch (error: any) {
    if (error.status === 404) {
      void showAndLogErrorMessage(
        `Controller repository was not found. Please make sure it's a valid repo name.${eol}`,
      );
    } else {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(error),
        )`Error submitting remote queries request: ${getErrorMessage(error)}`,
      );
    }
  }
}

const eol = EOL;
const eol2 = EOL + EOL;

// exported for testing only
export function parseResponse(
  controllerRepo: Repository,
  response: RemoteQueriesResponse,
) {
  const repositoriesQueried = response.repositories_queried;
  const repositoryCount = repositoriesQueried.length;

  const popupMessage = `Successfully scheduled runs on ${pluralize(
    repositoryCount,
    "repository",
    "repositories",
  )}. [Click here to see the progress](https://github.com/${
    controllerRepo.fullName
  }/actions/runs/${response.workflow_run_id}).${
    response.errors
      ? `${eol2}Some repositories could not be scheduled. See extension log for details.`
      : ""
  }`;

  let logMessage = `Successfully scheduled runs on ${pluralize(
    repositoryCount,
    "repository",
    "repositories",
  )}. See https://github.com/${controllerRepo.fullName}/actions/runs/${
    response.workflow_run_id
  }.`;
  logMessage += `${eol2}Repositories queried:${eol}${repositoriesQueried.join(
    ", ",
  )}`;
  if (response.errors) {
    const {
      invalid_repositories,
      repositories_without_database,
      private_repositories,
      cutoff_repositories,
      cutoff_repositories_count,
    } = response.errors;
    logMessage += `${eol2}Some repositories could not be scheduled.`;
    if (invalid_repositories?.length) {
      logMessage += `${eol2}${pluralize(
        invalid_repositories.length,
        "repository",
        "repositories",
      )} invalid and could not be found:${eol}${invalid_repositories.join(
        ", ",
      )}`;
    }
    if (repositories_without_database?.length) {
      logMessage += `${eol2}${pluralize(
        repositories_without_database.length,
        "repository",
        "repositories",
      )} did not have a CodeQL database available:${eol}${repositories_without_database.join(
        ", ",
      )}`;
      logMessage += `${eol}For each public repository that has not yet been added to the database service, we will try to create a database next time the store is updated.`;
    }
    if (private_repositories?.length) {
      logMessage += `${eol2}${pluralize(
        private_repositories.length,
        "repository",
        "repositories",
      )} not public:${eol}${private_repositories.join(", ")}`;
      logMessage += `${eol}When using a public controller repository, only public repositories can be queried.`;
    }
    if (cutoff_repositories_count) {
      logMessage += `${eol2}${pluralize(
        cutoff_repositories_count,
        "repository",
        "repositories",
      )} over the limit for a single request`;
      if (cutoff_repositories) {
        logMessage += `:${eol}${cutoff_repositories.join(", ")}`;
        if (cutoff_repositories_count !== cutoff_repositories.length) {
          const moreRepositories =
            cutoff_repositories_count - cutoff_repositories.length;
          logMessage += `${eol}...${eol}And another ${pluralize(
            moreRepositories,
            "repository",
            "repositories",
          )}.`;
        }
      } else {
        logMessage += ".";
      }
      logMessage += `${eol}Repositories were selected based on how recently they had been updated.`;
    }
  }

  return {
    popupMessage,
    logMessage,
  };
}
