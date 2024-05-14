import type { RequestError } from "@octokit/request-error";
import type { NotificationLogger } from "../common/logging";
import { showAndLogErrorMessage } from "../common/logging";

type ApiError = {
  resource: string;
  field: string;
  code: string;
};

type ErrorResponse = {
  message: string;
  errors?: ApiError[];
};

export function handleRequestError(
  e: RequestError,
  githubUrl: URL,
  logger: NotificationLogger,
): boolean {
  if (e.status !== 422) {
    return false;
  }

  if (!e.response?.data) {
    return false;
  }

  const data = e.response.data;
  if (!isErrorResponse(data)) {
    return false;
  }

  if (!data.errors) {
    return false;
  }

  // This is the only custom error message we have
  const missingDefaultBranchError = data.errors.find(
    (error) =>
      error.resource === "Repository" &&
      error.field === "default_branch" &&
      error.code === "missing",
  );

  if (!missingDefaultBranchError) {
    return false;
  }

  if (
    !("repository" in missingDefaultBranchError) ||
    typeof missingDefaultBranchError.repository !== "string"
  ) {
    return false;
  }

  if (
    !("default_branch" in missingDefaultBranchError) ||
    typeof missingDefaultBranchError.default_branch !== "string"
  ) {
    return false;
  }

  const createBranchURL = new URL(
    `/${
      missingDefaultBranchError.repository
    }/new/${encodeURIComponent(missingDefaultBranchError.default_branch)}`,
    githubUrl,
  ).toString();

  void showAndLogErrorMessage(
    logger,
    `Variant analysis failed because the controller repository ${missingDefaultBranchError.repository} does not have a branch '${missingDefaultBranchError.default_branch}'. ` +
      `Please create a '${missingDefaultBranchError.default_branch}' branch by clicking [here](${createBranchURL}) and re-run the variant analysis query.`,
    {
      fullMessage: e.message,
    },
  );

  return true;
}

function isErrorResponse(obj: unknown): obj is ErrorResponse {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "message" in obj &&
    typeof obj.message === "string"
  );
}
