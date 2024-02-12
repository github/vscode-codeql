/**
 * This scripts helps after adding a new field in the GitHub API. You will
 * need to modify this script to add the new field to the scenarios. This
 * is just a template and should not be used as-is since it has already been
 * applied.
 *
 * Depending on the actual implementation of the script, you might run into
 * rate limits. If that happens, you can set a `GITHUB_TOKEN` environment
 * variable. For example, use: ``export GITHUB_TOKEN=`gh auth token```.
 *
 * Usage: npx ts-node scripts/add-fields-to-scenarios.ts
 */

import { pathExists, readJson, writeJson } from "fs-extra";
import { resolve, relative } from "path";

import type { Octokit } from "@octokit/core";
import type { EndpointDefaults } from "@octokit/types";
import type { RestEndpointMethodTypes } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";

import { getFiles } from "./util/files";
import type { GitHubApiRequest } from "../src/common/mock-gh-api/gh-api-request";
import { isGetVariantAnalysisRequest } from "../src/common/mock-gh-api/gh-api-request";
import type { VariantAnalysis } from "../src/variant-analysis/gh-api/variant-analysis";
import type { RepositoryWithMetadata } from "../src/variant-analysis/gh-api/repository";
import { AppOctokit } from "../src/common/octokit";

const extensionDirectory = resolve(__dirname, "..");
const scenariosDirectory = resolve(
  extensionDirectory,
  "src/common/mock-gh-api/scenarios",
);

// Make sure we don't run into rate limits by automatically waiting until we can
// make another request.
const MyOctokit = AppOctokit.plugin(throttling);

const auth = process.env.GITHUB_TOKEN;

const octokit = new MyOctokit({
  auth,
  throttle: {
    onRateLimit: (
      retryAfter: number,
      options: EndpointDefaults,
      octokit: Octokit,
    ): boolean => {
      octokit.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds!`,
      );

      return true;
    },
    onSecondaryRateLimit: (
      _retryAfter: number,
      options: EndpointDefaults,
      octokit: Octokit,
    ): void => {
      octokit.log.warn(
        `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
      );
    },
  },
});
const repositories = new Map<
  number,
  RestEndpointMethodTypes["repos"]["get"]["response"]["data"]
>();

async function addFieldsToRepository(repository: RepositoryWithMetadata) {
  if (!repositories.has(repository.id)) {
    const [owner, repo] = repository.full_name.split("/");

    const apiRepository = await octokit.repos.get({
      owner,
      repo,
    });

    repositories.set(repository.id, apiRepository.data);
  }

  const apiRepository = repositories.get(repository.id)!;

  repository.stargazers_count = apiRepository.stargazers_count;
  repository.updated_at = apiRepository.updated_at;
}

async function addFieldsToScenarios() {
  if (!(await pathExists(scenariosDirectory))) {
    console.error(`Scenarios directory does not exist: ${scenariosDirectory}`);
    return;
  }

  for await (const file of getFiles(scenariosDirectory)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const data: GitHubApiRequest = await readJson(file);

    if (!isGetVariantAnalysisRequest(data)) {
      continue;
    }

    if (!data.response.body || !("controller_repo" in data.response.body)) {
      continue;
    }

    console.log(`Adding fields to '${relative(scenariosDirectory, file)}'`);

    const variantAnalysis = data.response.body as VariantAnalysis;

    if (variantAnalysis.scanned_repositories) {
      for (const item of variantAnalysis.scanned_repositories) {
        await addFieldsToRepository(item.repository);
      }
    }

    if (variantAnalysis.skipped_repositories?.access_mismatch_repos) {
      for (const item of variantAnalysis.skipped_repositories
        .access_mismatch_repos.repositories) {
        await addFieldsToRepository(item);
      }
    }

    if (variantAnalysis.skipped_repositories?.no_codeql_db_repos) {
      for (const item of variantAnalysis.skipped_repositories.no_codeql_db_repos
        .repositories) {
        await addFieldsToRepository(item);
      }
    }

    if (variantAnalysis.skipped_repositories?.over_limit_repos) {
      for (const item of variantAnalysis.skipped_repositories.over_limit_repos
        .repositories) {
        await addFieldsToRepository(item);
      }
    }

    await writeJson(file, data, { spaces: 2 });
  }
}

addFieldsToScenarios().catch((e: unknown) => {
  console.error(e);
  process.exit(2);
});
