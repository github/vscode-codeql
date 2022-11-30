import * as os from "os";
import { parseResponse } from "../../../remote-queries/remote-queries-api";
import { Repository } from "../../../remote-queries/shared/repository";

describe("parseResponse", () => {
  const controllerRepository: Repository = {
    id: 123,
    fullName: "org/name",
    private: true,
  };

  it("should parse a successful response", () => {
    const result = parseResponse(controllerRepository, {
      workflow_run_id: 123,
      repositories_queried: ["a/b", "c/d"],
    });

    expect(result.popupMessage).toBe(
      "Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).",
    );
    expect(result.logMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.",
        "",
        "Repositories queried:",
        "a/b, c/d",
      ].join(os.EOL),
    );
  });

  it("should parse a response with invalid repos", () => {
    const result = parseResponse(controllerRepository, {
      workflow_run_id: 123,
      repositories_queried: ["a/b", "c/d"],
      errors: {
        invalid_repositories: ["e/f", "g/h"],
      },
    });

    expect(result.popupMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).",
        "",
        "Some repositories could not be scheduled. See extension log for details.",
      ].join(os.EOL),
    );
    expect(result.logMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.",
        "",
        "Repositories queried:",
        "a/b, c/d",
        "",
        "Some repositories could not be scheduled.",
        "",
        "2 repositories invalid and could not be found:",
        "e/f, g/h",
      ].join(os.EOL),
    );
  });

  it("should parse a response with repos w/o databases", () => {
    const result = parseResponse(controllerRepository, {
      workflow_run_id: 123,
      repositories_queried: ["a/b", "c/d"],
      errors: {
        repositories_without_database: ["e/f", "g/h"],
      },
    });

    expect(result.popupMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).",
        "",
        "Some repositories could not be scheduled. See extension log for details.",
      ].join(os.EOL),
    );
    expect(result.logMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.",
        "",
        "Repositories queried:",
        "a/b, c/d",
        "",
        "Some repositories could not be scheduled.",
        "",
        "2 repositories did not have a CodeQL database available:",
        "e/f, g/h",
        "For each public repository that has not yet been added to the database service, we will try to create a database next time the store is updated.",
      ].join(os.EOL),
    );
  });

  it("should parse a response with private repos", () => {
    const result = parseResponse(controllerRepository, {
      workflow_run_id: 123,
      repositories_queried: ["a/b", "c/d"],
      errors: {
        private_repositories: ["e/f", "g/h"],
      },
    });

    expect(result.popupMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).",
        "",
        "Some repositories could not be scheduled. See extension log for details.",
      ].join(os.EOL),
    );
    expect(result.logMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.",
        "",
        "Repositories queried:",
        "a/b, c/d",
        "",
        "Some repositories could not be scheduled.",
        "",
        "2 repositories not public:",
        "e/f, g/h",
        "When using a public controller repository, only public repositories can be queried.",
      ].join(os.EOL),
    );
  });

  it("should parse a response with cutoff repos and cutoff repos count", () => {
    const result = parseResponse(controllerRepository, {
      workflow_run_id: 123,
      repositories_queried: ["a/b", "c/d"],
      errors: {
        cutoff_repositories: ["e/f", "g/h"],
        cutoff_repositories_count: 2,
      },
    });

    expect(result.popupMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).",
        "",
        "Some repositories could not be scheduled. See extension log for details.",
      ].join(os.EOL),
    );
    expect(result.logMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.",
        "",
        "Repositories queried:",
        "a/b, c/d",
        "",
        "Some repositories could not be scheduled.",
        "",
        "2 repositories over the limit for a single request:",
        "e/f, g/h",
        "Repositories were selected based on how recently they had been updated.",
      ].join(os.EOL),
    );
  });

  it("should parse a response with cutoff repos count but not cutoff repos", () => {
    const result = parseResponse(controllerRepository, {
      workflow_run_id: 123,
      repositories_queried: ["a/b", "c/d"],
      errors: {
        cutoff_repositories_count: 2,
      },
    });

    expect(result.popupMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).",
        "",
        "Some repositories could not be scheduled. See extension log for details.",
      ].join(os.EOL),
    );
    expect(result.logMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.",
        "",
        "Repositories queried:",
        "a/b, c/d",
        "",
        "Some repositories could not be scheduled.",
        "",
        "2 repositories over the limit for a single request.",
        "Repositories were selected based on how recently they had been updated.",
      ].join(os.EOL),
    );
  });

  it("should parse a response with invalid repos and repos w/o databases", () => {
    const result = parseResponse(controllerRepository, {
      workflow_run_id: 123,
      repositories_queried: ["a/b", "c/d"],
      errors: {
        invalid_repositories: ["e/f", "g/h"],
        repositories_without_database: ["i/j", "k/l"],
      },
    });

    expect(result.popupMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. [Click here to see the progress](https://github.com/org/name/actions/runs/123).",
        "",
        "Some repositories could not be scheduled. See extension log for details.",
      ].join(os.EOL),
    );
    expect(result.logMessage).toBe(
      [
        "Successfully scheduled runs on 2 repositories. See https://github.com/org/name/actions/runs/123.",
        "",
        "Repositories queried:",
        "a/b, c/d",
        "",
        "Some repositories could not be scheduled.",
        "",
        "2 repositories invalid and could not be found:",
        "e/f, g/h",
        "",
        "2 repositories did not have a CodeQL database available:",
        "i/j, k/l",
        "For each public repository that has not yet been added to the database service, we will try to create a database next time the store is updated.",
      ].join(os.EOL),
    );
  });

  it('should parse a response with one repo of each category, and not pluralize "repositories"', () => {
    const result = parseResponse(controllerRepository, {
      workflow_run_id: 123,
      repositories_queried: ["a/b"],
      errors: {
        private_repositories: ["e/f"],
        cutoff_repositories: ["i/j"],
        cutoff_repositories_count: 1,
        invalid_repositories: ["m/n"],
        repositories_without_database: ["q/r"],
      },
    });

    expect(result.popupMessage).toBe(
      [
        "Successfully scheduled runs on 1 repository. [Click here to see the progress](https://github.com/org/name/actions/runs/123).",
        "",
        "Some repositories could not be scheduled. See extension log for details.",
      ].join(os.EOL),
    );
    expect(result.logMessage).toBe(
      [
        "Successfully scheduled runs on 1 repository. See https://github.com/org/name/actions/runs/123.",
        "",
        "Repositories queried:",
        "a/b",
        "",
        "Some repositories could not be scheduled.",
        "",
        "1 repository invalid and could not be found:",
        "m/n",
        "",
        "1 repository did not have a CodeQL database available:",
        "q/r",
        "For each public repository that has not yet been added to the database service, we will try to create a database next time the store is updated.",
        "",
        "1 repository not public:",
        "e/f",
        "When using a public controller repository, only public repositories can be queried.",
        "",
        "1 repository over the limit for a single request:",
        "i/j",
        "Repositories were selected based on how recently they had been updated.",
      ].join(os.EOL),
    );
  });
});
