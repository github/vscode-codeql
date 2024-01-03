import * as fetch from "node-fetch";
import * as semver from "semver";
import { URL } from "url";
import { Release, ReleaseAsset } from "./release";
import { GithubRateLimitedError, GithubApiError } from "./github-api-error";

/**
 * Communicates with the GitHub API to determine the latest compatible release and download assets.
 */
export class ReleasesApiConsumer {
  constructor(
    ownerName: string,
    repoName: string,
    personalAccessToken?: string,
  ) {
    // Specify version of the GitHub API
    this._defaultHeaders["accept"] = "application/vnd.github.v3+json";

    if (personalAccessToken) {
      this._defaultHeaders["authorization"] = `token ${personalAccessToken}`;
    }

    this._ownerName = ownerName;
    this._repoName = repoName;
  }

  public async getLatestRelease(
    versionRange: semver.Range | undefined,
    orderBySemver = true,
    includePrerelease = false,
    additionalCompatibilityCheck?: (release: GithubRelease) => boolean,
  ): Promise<Release> {
    const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases`;
    const allReleases: GithubRelease[] = await (
      await this.makeApiCall(apiPath)
    ).json();
    const compatibleReleases = allReleases.filter((release) => {
      if (release.prerelease && !includePrerelease) {
        return false;
      }

      if (versionRange !== undefined) {
        const version = semver.parse(release.tag_name);
        if (
          version === null ||
          !semver.satisfies(version, versionRange, { includePrerelease })
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
        ? semver.compare(semver.parse(b.tag_name)!, semver.parse(a.tag_name)!)
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
  ): Promise<fetch.Response> {
    const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases/assets/${asset.id}`;

    return await this.makeApiCall(apiPath, {
      accept: "application/octet-stream",
    });
  }

  protected async makeApiCall(
    apiPath: string,
    additionalHeaders: { [key: string]: string } = {},
  ): Promise<fetch.Response> {
    const response = await this.makeRawRequest(
      ReleasesApiConsumer._apiBase + apiPath,
      Object.assign({}, this._defaultHeaders, additionalHeaders),
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
    redirectCount = 0,
  ): Promise<fetch.Response> {
    const response = await fetch.default(requestUrl, {
      headers,
      redirect: "manual",
    });

    const redirectUrl = response.headers.get("location");
    if (
      isRedirectStatusCode(response.status) &&
      redirectUrl &&
      redirectCount < ReleasesApiConsumer._maxRedirects
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
      return await this.makeRawRequest(redirectUrl, headers, redirectCount + 1);
    }

    return response;
  }

  private readonly _defaultHeaders: { [key: string]: string } = {};
  private readonly _ownerName: string;
  private readonly _repoName: string;

  private static readonly _apiBase = "https://api.github.com";
  private static readonly _maxRedirects = 20;
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
export interface GithubReleaseAsset {
  id: number;
  name: string;
  size: number;
}
