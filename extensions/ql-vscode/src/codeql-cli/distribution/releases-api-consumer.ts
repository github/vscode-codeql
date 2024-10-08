import type { Range } from "semver";
import { compare, parse, satisfies } from "semver";
import { URL } from "url";
import type { Release, ReleaseAsset } from "./release";
import { GithubApiError, GithubRateLimitedError } from "./github-api-error";

/**
 * Communicates with the GitHub API to determine the latest compatible release and download assets.
 */
export class ReleasesApiConsumer {
  private static readonly apiBase = "https://api.github.com";
  private static readonly maxRedirects = 20;

  private readonly defaultHeaders: { [key: string]: string } = {};

  constructor(
    private readonly repositoryNwo: string,
    personalAccessToken?: string,
  ) {
    // Specify version of the GitHub API
    this.defaultHeaders["accept"] = "application/vnd.github.v3+json";

    if (personalAccessToken) {
      this.defaultHeaders["authorization"] = `token ${personalAccessToken}`;
    }
  }

  public async getLatestRelease(
    versionRange: Range | undefined,
    orderBySemver = true,
    includePrerelease = false,
    additionalCompatibilityCheck?: (release: GithubRelease) => boolean,
  ): Promise<Release> {
    const apiPath = `/repos/${this.repositoryNwo}/releases`;
    const allReleases = (await (
      await this.makeApiCall(apiPath)
    ).json()) as GithubRelease[];
    const compatibleReleases = allReleases.filter((release) => {
      if (release.prerelease && !includePrerelease) {
        return false;
      }

      if (versionRange !== undefined) {
        const version = parse(release.tag_name);
        if (
          version === null ||
          !satisfies(version, versionRange, { includePrerelease })
        ) {
          return false;
        }
      }

      return (
        !additionalCompatibilityCheck || additionalCompatibilityCheck(release)
      );
    });
    // Tag names must all be parsable to semvers due to the previous filtering step.
    const latestRelease = compatibleReleases.sort((a, b) => {
      const versionComparison = orderBySemver
        ? compare(parse(b.tag_name)!, parse(a.tag_name)!)
        : b.id - a.id;
      if (versionComparison !== 0) {
        return versionComparison;
      }
      return b.created_at.localeCompare(a.created_at, "en-US");
    })[0];
    if (latestRelease === undefined) {
      throw new Error(
        "No compatible CodeQL CLI releases were found. " +
          "Please check that the CodeQL extension is up to date.",
      );
    }
    const assets: ReleaseAsset[] = latestRelease.assets.map((asset) => {
      return {
        id: asset.id,
        name: asset.name,
        size: asset.size,
      };
    });

    return {
      assets,
      createdAt: latestRelease.created_at,
      id: latestRelease.id,
      name: latestRelease.name,
    };
  }

  public async streamBinaryContentOfAsset(
    asset: ReleaseAsset,
    signal?: AbortSignal,
  ): Promise<Response> {
    const apiPath = `/repos/${this.repositoryNwo}/releases/assets/${asset.id}`;

    return await this.makeApiCall(
      apiPath,
      {
        accept: "application/octet-stream",
      },
      signal,
    );
  }

  protected async makeApiCall(
    apiPath: string,
    additionalHeaders: { [key: string]: string } = {},
    signal?: AbortSignal,
  ): Promise<Response> {
    const response = await this.makeRawRequest(
      ReleasesApiConsumer.apiBase + apiPath,
      Object.assign({}, this.defaultHeaders, additionalHeaders),
      signal,
    );

    if (!response.ok) {
      // Check for rate limiting
      const rateLimitResetValue = response.headers.get("X-RateLimit-Reset");
      if (response.status === 403 && rateLimitResetValue) {
        const secondsToMillisecondsFactor = 1000;
        const rateLimitResetDate = new Date(
          parseInt(rateLimitResetValue, 10) * secondsToMillisecondsFactor,
        );
        throw new GithubRateLimitedError(
          response.status,
          await response.text(),
          rateLimitResetDate,
        );
      }
      throw new GithubApiError(response.status, await response.text());
    }
    return response;
  }

  private async makeRawRequest(
    requestUrl: string,
    headers: { [key: string]: string },
    signal?: AbortSignal,
    redirectCount = 0,
  ): Promise<Response> {
    const response = await fetch(requestUrl, {
      headers,
      redirect: "manual",
      signal,
    });

    const redirectUrl = response.headers.get("location");
    if (
      isRedirectStatusCode(response.status) &&
      redirectUrl &&
      redirectCount < ReleasesApiConsumer.maxRedirects
    ) {
      const parsedRedirectUrl = new URL(redirectUrl);
      if (parsedRedirectUrl.protocol !== "https:") {
        throw new Error("Encountered a non-https redirect, rejecting");
      }
      if (parsedRedirectUrl.host !== "api.github.com") {
        // Remove authorization header if we are redirected outside of the GitHub API.
        //
        // This is necessary to stream release assets since AWS fails if more than one auth
        // mechanism is provided.
        delete headers["authorization"];
      }
      return await this.makeRawRequest(
        redirectUrl,
        headers,
        signal,
        redirectCount + 1,
      );
    }

    return response;
  }
}

function isRedirectStatusCode(statusCode: number): boolean {
  return (
    statusCode === 301 ||
    statusCode === 302 ||
    statusCode === 303 ||
    statusCode === 307 ||
    statusCode === 308
  );
}

/**
 * The json returned from github for a release.
 * See https://docs.github.com/en/rest/releases/releases#get-a-release for example response and response schema.
 *
 * This type must match the format of the GitHub API and is not intended to be used outside of this file except for tests. Please use the `Release` type instead.
 */
export interface GithubRelease {
  assets: GithubReleaseAsset[];
  created_at: string;
  id: number;
  name: string;
  prerelease: boolean;
  tag_name: string;
}

/**
 * The json returned by github for an asset in a release.
 * See https://docs.github.com/en/rest/releases/releases#get-a-release for example response and response schema.
 *
 * This type must match the format of the GitHub API and is not intended to be used outside of this file except for tests. Please use the `ReleaseAsset` type instead.
 */
interface GithubReleaseAsset {
  id: number;
  name: string;
  size: number;
}
