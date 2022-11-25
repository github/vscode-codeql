import { faker } from "@faker-js/faker";
import { VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository } from "../../../src/remote-queries/gh-api/variant-analysis";
import {
  VariantAnalysisQueryLanguage,
  VariantAnalysisScannedRepository,
  VariantAnalysisRepoStatus,
} from "../../../src/remote-queries/shared/variant-analysis";
import {
  processScannedRepository,
  processVariantAnalysis,
  processVariantAnalysisRepositoryTask,
} from "../../../src/remote-queries/variant-analysis-processor";
import {
  createMockScannedRepo,
  createMockScannedRepos,
} from "../../../src/vscode-tests/factories/remote-queries/gh-api/scanned-repositories";
import { createMockSkippedRepos } from "../../../src/vscode-tests/factories/remote-queries/gh-api/skipped-repositories";
import { createMockApiResponse } from "../../../src/vscode-tests/factories/remote-queries/gh-api/variant-analysis-api-response";
import { createMockSubmission } from "../../../src/vscode-tests/factories/remote-queries/shared/variant-analysis-submission";
import { createMockVariantAnalysisRepoTask } from "../../../src/vscode-tests/factories/remote-queries/gh-api/variant-analysis-repo-task";

describe(processVariantAnalysis.name, () => {
  const scannedRepos = createMockScannedRepos();
  const skippedRepos = createMockSkippedRepos();
  const mockApiResponse = createMockApiResponse(
    "succeeded",
    scannedRepos,
    skippedRepos,
  );
  const mockSubmission = createMockSubmission();

  it("should process an API response and return a variant analysis", () => {
    const result = processVariantAnalysis(mockSubmission, mockApiResponse);

    const {
      access_mismatch_repos,
      no_codeql_db_repos,
      not_found_repos,
      over_limit_repos,
    } = skippedRepos;

    expect(result).toEqual({
      id: mockApiResponse.id,
      controllerRepo: {
        id: mockApiResponse.controller_repo.id,
        fullName: mockApiResponse.controller_repo.full_name,
        private: mockApiResponse.controller_repo.private,
      },
      query: {
        filePath: "query-file-path",
        language: VariantAnalysisQueryLanguage.Javascript,
        name: "query-name",
        text: mockSubmission.query.text,
      },
      databases: {
        repositories: ["1", "2", "3"],
      },
      executionStartTime: mockSubmission.startTime,
      createdAt: mockApiResponse.created_at,
      updatedAt: mockApiResponse.updated_at,
      status: "succeeded",
      completedAt: mockApiResponse.completed_at,
      actionsWorkflowRunId: mockApiResponse.actions_workflow_run_id,
      scannedRepos: [
        transformScannedRepo(
          VariantAnalysisRepoStatus.Succeeded,
          scannedRepos[0],
        ),
        transformScannedRepo(
          VariantAnalysisRepoStatus.Pending,
          scannedRepos[1],
        ),
        transformScannedRepo(
          VariantAnalysisRepoStatus.InProgress,
          scannedRepos[2],
        ),
      ],
      skippedRepos: {
        accessMismatchRepos: {
          repositories: [
            {
              fullName: access_mismatch_repos?.repositories[0].full_name,
              id: access_mismatch_repos?.repositories[0].id,
              private: access_mismatch_repos?.repositories[0].private,
              stargazersCount:
                access_mismatch_repos?.repositories[0].stargazers_count,
              updatedAt: access_mismatch_repos?.repositories[0].updated_at,
            },
            {
              fullName: access_mismatch_repos?.repositories[1].full_name,
              id: access_mismatch_repos?.repositories[1].id,
              private: access_mismatch_repos?.repositories[1].private,
              stargazersCount:
                access_mismatch_repos?.repositories[1].stargazers_count,
              updatedAt: access_mismatch_repos?.repositories[1].updated_at,
            },
          ],
          repositoryCount: access_mismatch_repos?.repository_count,
        },
        noCodeqlDbRepos: {
          repositories: [
            {
              fullName: no_codeql_db_repos?.repositories[0].full_name,
              id: no_codeql_db_repos?.repositories[0].id,
              private: no_codeql_db_repos?.repositories[0].private,
              stargazersCount:
                no_codeql_db_repos?.repositories[0].stargazers_count,
              updatedAt: no_codeql_db_repos?.repositories[0].updated_at,
            },
            {
              fullName: no_codeql_db_repos?.repositories[1].full_name,
              id: no_codeql_db_repos?.repositories[1].id,
              private: no_codeql_db_repos?.repositories[1].private,
              stargazersCount:
                no_codeql_db_repos?.repositories[1].stargazers_count,
              updatedAt: no_codeql_db_repos?.repositories[1].updated_at,
            },
          ],
          repositoryCount: 2,
        },
        notFoundRepos: {
          repositories: [
            {
              fullName: not_found_repos?.repository_full_names[0],
            },
            {
              fullName: not_found_repos?.repository_full_names[1],
            },
          ],
          repositoryCount: not_found_repos?.repository_count,
        },
        overLimitRepos: {
          repositories: [
            {
              fullName: over_limit_repos?.repositories[0].full_name,
              id: over_limit_repos?.repositories[0].id,
              private: over_limit_repos?.repositories[0].private,
              stargazersCount:
                over_limit_repos?.repositories[0].stargazers_count,
              updatedAt: over_limit_repos?.repositories[0].updated_at,
            },
            {
              fullName: over_limit_repos?.repositories[1].full_name,
              id: over_limit_repos?.repositories[1].id,
              private: over_limit_repos?.repositories[1].private,
              stargazersCount:
                over_limit_repos?.repositories[1].stargazers_count,
              updatedAt: over_limit_repos?.repositories[1].updated_at,
            },
          ],
          repositoryCount: over_limit_repos?.repository_count,
        },
      },
    });
  });

  function transformScannedRepo(
    status: VariantAnalysisRepoStatus,
    scannedRepo: ApiVariantAnalysisScannedRepository,
  ): VariantAnalysisScannedRepository {
    return {
      analysisStatus: status,
      artifactSizeInBytes: scannedRepo.artifact_size_in_bytes,
      failureMessage: scannedRepo.failure_message,
      repository: {
        fullName: scannedRepo.repository.full_name,
        id: scannedRepo.repository.id,
        private: scannedRepo.repository.private,
        stargazersCount: scannedRepo.repository.stargazers_count,
        updatedAt: scannedRepo.repository.updated_at,
      },
      resultCount: scannedRepo.result_count,
    };
  }
});

describe(processVariantAnalysisRepositoryTask.name, () => {
  const mockApiResponse = createMockVariantAnalysisRepoTask();

  it("should return the correct result", () => {
    expect(processVariantAnalysisRepositoryTask(mockApiResponse)).toEqual({
      repository: {
        id: mockApiResponse.repository.id,
        fullName: mockApiResponse.repository.full_name,
        private: mockApiResponse.repository.private,
      },
      analysisStatus: "succeeded",
      resultCount: mockApiResponse.result_count,
      artifactSizeInBytes: mockApiResponse.artifact_size_in_bytes,
      failureMessage: mockApiResponse.failure_message,
      databaseCommitSha: mockApiResponse.database_commit_sha,
      sourceLocationPrefix: mockApiResponse.source_location_prefix,
      artifactUrl: mockApiResponse.artifact_url,
    });
  });
});

describe(processScannedRepository.name, () => {
  const mockApiResponse = createMockScannedRepo(
    faker.random.word(),
    faker.datatype.boolean(),
    VariantAnalysisRepoStatus.Pending,
  );

  it("should return the correct result", () => {
    expect(processScannedRepository(mockApiResponse)).toEqual({
      repository: {
        id: mockApiResponse.repository.id,
        fullName: mockApiResponse.repository.full_name,
        private: mockApiResponse.repository.private,
        stargazersCount: mockApiResponse.repository.stargazers_count,
        updatedAt: mockApiResponse.repository.updated_at,
      },
      analysisStatus: "pending",
      resultCount: mockApiResponse.result_count,
      artifactSizeInBytes: mockApiResponse.artifact_size_in_bytes,
      failureMessage: mockApiResponse.failure_message,
    });
  });
});
