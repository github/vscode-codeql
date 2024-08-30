import { RequestError } from "@octokit/request-error";
import { createMockLogger } from "../../__mocks__/loggerMock";
import { handleRequestError } from "../../../src/variant-analysis/custom-errors";
import { faker } from "@faker-js/faker";

describe("handleRequestError", () => {
  const githubUrl = new URL("https://github.com");
  const logger = createMockLogger();

  it("returns false when handling a non-422 error", () => {
    const e = mockRequestError(404, {
      message: "Not Found",
    });
    expect(handleRequestError(e, githubUrl, logger)).toBe(false);
    expect(logger.showErrorMessage).not.toHaveBeenCalled();
  });

  it("returns false when handling a different error without errors", () => {
    const e = mockRequestError(422, {
      message:
        "Unable to trigger a variant analysis. None of the requested repositories could be found.",
    });
    expect(handleRequestError(e, githubUrl, logger)).toBe(false);
    expect(logger.showErrorMessage).not.toHaveBeenCalled();
  });

  it("returns false when handling an error without response body", () => {
    const e = mockRequestError(422, undefined);
    expect(handleRequestError(e, githubUrl, logger)).toBe(false);
    expect(logger.showErrorMessage).not.toHaveBeenCalled();
  });

  it("returns false when handling an error without response", () => {
    const e = new RequestError("Timeout", 500, {
      request: {
        method: "POST",
        url: faker.internet.url(),
        headers: {
          "Content-Type": "application/json",
        },
      },
    });
    expect(handleRequestError(e, githubUrl, logger)).toBe(false);
    expect(logger.showErrorMessage).not.toHaveBeenCalled();
  });

  it("returns false when handling a different error with errors", () => {
    const e = mockRequestError(422, {
      message:
        "Unable to trigger a variant analysis. None of the requested repositories could be found.",
      errors: [
        {
          resource: "VariantAnalysis",
          field: "repositories",
          code: "not_found",
        },
      ],
    });
    expect(handleRequestError(e, githubUrl, logger)).toBe(false);
    expect(logger.showErrorMessage).not.toHaveBeenCalled();
  });

  it("returns false when handling without repository field", () => {
    const e = mockRequestError(422, {
      message:
        "Variant analysis failed because controller repository github/pickles does not have a branch 'main'. Please create a 'main' branch in the repository and re-run the variant analysis.",
      errors: [
        {
          resource: "Repository",
          field: "default_branch",
          code: "missing",
          default_branch: "main",
        },
      ],
    });
    expect(handleRequestError(e, githubUrl, logger)).toBe(false);
    expect(logger.showErrorMessage).not.toHaveBeenCalled();
  });

  it("returns false when handling without default_branch field", () => {
    const e = mockRequestError(422, {
      message:
        "Variant analysis failed because controller repository github/pickles does not have a branch 'main'. Please create a 'main' branch in the repository and re-run the variant analysis.",
      errors: [
        {
          resource: "Repository",
          field: "default_branch",
          code: "missing",
          repository: "github/pickles",
        },
      ],
    });
    expect(handleRequestError(e, githubUrl, logger)).toBe(false);
    expect(logger.showErrorMessage).not.toHaveBeenCalled();
  });

  it("shows notification when handling a missing default branch error with github.com URL", () => {
    const e = mockRequestError(422, {
      message:
        "Variant analysis failed because controller repository github/pickles does not have a branch 'main'. Please create a 'main' branch in the repository and re-run the variant analysis.",
      errors: [
        {
          resource: "Repository",
          field: "default_branch",
          code: "missing",
          repository: "github/pickles",
          default_branch: "main",
        },
      ],
    });
    expect(handleRequestError(e, githubUrl, logger)).toBe(true);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      "Variant analysis failed because the controller repository github/pickles does not have a branch 'main'. Please create a 'main' branch by clicking [here](https://github.com/github/pickles/new/main) and re-run the variant analysis query.",
    );
  });

  it("shows notification when handling a missing default branch error with GHEC-DR URL", () => {
    const e = mockRequestError(422, {
      message:
        "Variant analysis failed because controller repository github/pickles does not have a branch 'main'. Please create a 'main' branch in the repository and re-run the variant analysis.",
      errors: [
        {
          resource: "Repository",
          field: "default_branch",
          code: "missing",
          repository: "github/pickles",
          default_branch: "main",
        },
      ],
    });
    expect(
      handleRequestError(e, new URL("https://tenant.ghe.com"), logger),
    ).toBe(true);
    expect(logger.showErrorMessage).toHaveBeenCalledWith(
      "Variant analysis failed because the controller repository github/pickles does not have a branch 'main'. Please create a 'main' branch by clicking [here](https://tenant.ghe.com/github/pickles/new/main) and re-run the variant analysis query.",
    );
  });
});

function mockRequestError(status: number, body: any): RequestError {
  return new RequestError(
    body ? toErrorMessage(body) : "Unknown error",
    status,
    {
      request: {
        method: "POST",
        url: faker.internet.url(),
        headers: {
          "Content-Type": "application/json",
        },
      },
      response: {
        url: faker.internet.url(),
        status,
        headers: {
          "Content-Type": "application/json",
        },
        data: body,
        retryCount: 0,
      },
    },
  );
}

// Copied from https://github.com/octokit/request.js/blob/c67f902350384846f88d91196e7066daadc08357/src/fetch-wrapper.ts#L166 to have a
// somewhat realistic error message
function toErrorMessage(data: any) {
  if (typeof data === "string") {
    return data;
  }

  if ("message" in data) {
    if (Array.isArray(data.errors)) {
      return `${data.message}: ${data.errors.map(JSON.stringify).join(", ")}`;
    }

    return data.message;
  }

  // istanbul ignore next - just in case
  return `Unknown error: ${JSON.stringify(data)}`;
}
