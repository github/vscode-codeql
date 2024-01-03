export class GithubApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API call failed with status code ${status}, body: ${body}`);
  }
}

export class GithubRateLimitedError extends GithubApiError {
  constructor(
    public status: number,
    public body: string,
    public rateLimitResetDate: Date,
  ) {
    super(status, body);
  }
}
