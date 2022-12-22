import { retry } from "@octokit/plugin-retry";
import * as Octokit from "@octokit/rest";
import { RequestInterface } from "@octokit/types/dist-types/RequestInterface";

import { Credentials } from "../../common/authentication";

export class TestCredentials extends Credentials {
  private octokit: Octokit.Octokit;

  private constructor(octokit: Octokit.Octokit) {
    super();
    this.octokit = octokit;
  }

  static initializeWithStub(
    requestSpy?: jest.SpyInstance<RequestInterface<object>>,
  ): Credentials {
    return new TestCredentials({
      request:
        requestSpy ??
        jest.fn(async () => {
          throw new Error(
            "Tried to make HTTP request but no stub was provided",
          );
        }),
    } as any);
  }

  static initializeWithUnauthenticatedOctokit(): Credentials {
    return new TestCredentials(new Octokit.Octokit({ retry }));
  }

  static initializeWithToken(token: string): Credentials {
    return new TestCredentials(new Octokit.Octokit({ auth: token, retry }));
  }

  async getOctokit(): Promise<Octokit.Octokit> {
    return this.octokit;
  }
}
