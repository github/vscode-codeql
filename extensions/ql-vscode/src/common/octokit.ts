import * as Octokit from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import fetch from "node-fetch";

export const AppOctokit = Octokit.Octokit.defaults({
  request: {
    fetch,
  },
  retry,
});
