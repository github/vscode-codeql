import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";

export const AppOctokit = Octokit.defaults({
  request: {
    // MSW replaces the global fetch object, so we can't just pass a reference to the
    // fetch object at initialization time. Instead, we pass a function that will
    // always call the global fetch object.
    fetch: (input: string | URL | Request, init?: RequestInit) =>
      fetch(input, init),
  },
  retry,
});
