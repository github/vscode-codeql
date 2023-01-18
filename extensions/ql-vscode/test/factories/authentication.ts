import { retry } from "@octokit/plugin-retry";
import * as Octokit from "@octokit/rest";
import { RequestInterface } from "@octokit/types/dist-types/RequestInterface";

import { Credentials } from "../../src/common/authentication";

function makeTestOctokit(octokit: Octokit.Octokit): Credentials {
  return {
    getOctokit: async () => octokit,
    getAccessToken: async () => {
      throw new Error("getAccessToken not supported by test credentials");
    },
    getExistingAccessToken: async () => {
      throw new Error(
        "getExistingAccessToken not supported by test credentials",
      );
    },
  };
}

export function testCredentialsWithStub(
  requestSpy?: jest.SpyInstance<RequestInterface<object>>,
): Credentials {
  const request =
    requestSpy ??
    jest.fn(async () => {
      throw new Error("Tried to make HTTP request but no stub was provided");
    });
  return makeTestOctokit({ request } as any);
}

export function testCredentialsWithUnauthenticatedOctokit(): Credentials {
  return makeTestOctokit(new Octokit.Octokit({ retry }));
}

export function testCredentialsWithToken(token: string): Credentials {
  return makeTestOctokit(new Octokit.Octokit({ auth: token, retry }));
}
