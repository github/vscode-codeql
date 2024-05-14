import { throttling } from "@octokit/plugin-throttling";
import type { Octokit } from "@octokit/rest";
import type { CancellationToken } from "vscode";
import type { Credentials } from "../common/authentication";
import type { BaseLogger } from "../common/logging";
import { AppOctokit } from "../common/octokit";
import type { ProgressCallback } from "../common/vscode/progress";
import { UserCancellationException } from "../common/vscode/progress";
import type { EndpointDefaults } from "@octokit/types";
import { getOctokitBaseUrl } from "../common/vscode/octokit";

export async function getCodeSearchRepositories(
  query: string,
  progress: ProgressCallback,
  token: CancellationToken,
  credentials: Credentials,
  logger: BaseLogger,
): Promise<string[]> {
  const nwos: string[] = [];
  const octokit = await provideOctokitWithThrottling(credentials, logger);
  let i = 0;

  for await (const response of octokit.paginate.iterator(
    octokit.rest.search.code,
    {
      q: query,
      per_page: 100,
    },
  )) {
    i++;
    nwos.push(...response.data.map((item) => item.repository.full_name));
    const totalNumberOfResultPages = Math.ceil(response.data.total_count / 100);
    const totalNumberOfRequests =
      totalNumberOfResultPages > 10 ? 10 : totalNumberOfResultPages;
    progress({
      maxStep: totalNumberOfRequests,
      step: i,
      message: "Sending API requests to get Code Search results.",
    });

    if (token.isCancellationRequested) {
      throw new UserCancellationException("Code search cancelled.", true);
    }
  }

  return [...new Set(nwos)];
}

async function provideOctokitWithThrottling(
  credentials: Credentials,
  logger: BaseLogger,
): Promise<Octokit> {
  const MyOctokit = AppOctokit.plugin(throttling);
  const auth = await credentials.getAccessToken();

  const octokit = new MyOctokit({
    auth,
    baseUrl: getOctokitBaseUrl(),
    throttle: {
      onRateLimit: (retryAfter: number, options: EndpointDefaults): boolean => {
        void logger.log(
          `Rate Limit detected for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds!`,
        );

        return true;
      },
      onSecondaryRateLimit: (
        _retryAfter: number,
        options: EndpointDefaults,
      ): void => {
        void logger.log(
          `Secondary Rate Limit detected for request ${options.method} ${options.url}`,
        );
      },
    },
  });

  return octokit;
}
