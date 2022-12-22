import * as Octokit from "@octokit/rest";
import { Disposable } from "../pure/disposable-object";

let registeredCredentials: Credentials | undefined = undefined;

/**
 * Registers the credentials to be used during subsequent calls
 * to `getOctokit`. Should be called once during extension initialisation,
 * as well as during test setup. When used in tests, use the returned
 * callback to un-register the credentials in preparation for the next test.
 *
 * @param credentials A credentials instance
 * @returns A callback that can be used to un-register the credentials
 */
export function registerCredentials(credentials: Credentials): Disposable {
  if (registeredCredentials !== undefined) {
    throw new Error("Credential provider already registered");
  }
  registeredCredentials = credentials;

  return {
    dispose: () => {
      if (registeredCredentials !== credentials) {
        throw new Error(
          "Registered credentials have been changed by other code",
        );
      }
      registeredCredentials = undefined;
    },
  };
}

/**
 * Creates or returns an instance of Octokit.
 *
 * @returns An instance of Octokit.
 */
export async function getOctokit(): Promise<Octokit.Octokit> {
  if (registeredCredentials === undefined) {
    throw new Error("Credential provider not registered");
  }
  return registeredCredentials.getOctokit();
}

export abstract class Credentials {
  /**
   * Creates or returns an instance of Octokit.
   *
   * @returns An instance of Octokit.
   */
  abstract getOctokit(): Promise<Octokit.Octokit>;
}
