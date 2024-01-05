import { DisposableObject } from "./disposable-object";
import { getErrorMessage } from "./helpers-pure";
import type { BaseLogger } from "./logging";

/**
 * Base class for "discovery" operations, which scan the file system to find specific kinds of
 * files. This class automatically prevents more than one discovery operation from running at the
 * same time.
 */
export abstract class Discovery extends DisposableObject {
  private restartWhenFinished = false;
  private currentDiscoveryPromise: Promise<void> | undefined;

  constructor(
    protected readonly name: string,
    protected readonly logger: BaseLogger,
  ) {
    super();
  }

  /**
   * Returns the promise of the currently running refresh operation, if one is in progress.
   * Otherwise returns a promise that resolves immediately.
   */
  public waitForCurrentRefresh(): Promise<void> {
    return this.currentDiscoveryPromise ?? Promise.resolve();
  }

  /**
   * Force the discovery process to run. Normally invoked by the derived class when a relevant file
   * system change is detected.
   *
   * Returns a promise that resolves when the refresh is complete, including any retries.
   */
  public refresh(): Promise<void> {
    // We avoid having multiple discovery operations in progress at the same time. Otherwise, if we
    // got a storm of refresh requests due to, say, the copying or deletion of a large directory
    // tree, we could potentially spawn a separate simultaneous discovery operation for each
    // individual file change notification.
    // Our approach is to spawn a discovery operation immediately upon receiving the first refresh
    // request. If we receive any additional refresh requests before the first one is complete, we
    // record this fact by setting `this.retry = true`. When the original discovery operation
    // completes, we discard its results and spawn another one to account for that additional
    // changes that have happened since.
    // The means that for the common case of a single file being modified, we'll complete the
    // discovery and update as soon as possible. If multiple files are being modified, we'll
    // probably wind up doing discovery at least twice.
    // We could choose to delay the initial discovery request by a second or two to wait for any
    // other change notifications that might be coming along. However, this would create more
    // latency in the common case, in order to save a bit of latency in the uncommon case.

    if (this.currentDiscoveryPromise !== undefined) {
      // There's already a discovery operation in progress. Tell it to restart when it's done.
      this.restartWhenFinished = true;
    } else {
      // No discovery in progress, so start one now.
      this.currentDiscoveryPromise = this.launchDiscovery().finally(() => {
        this.currentDiscoveryPromise = undefined;
      });
    }
    return this.currentDiscoveryPromise;
  }

  /**
   * Starts the asynchronous discovery operation by invoking the `discover` function. When the
   * discovery operation completes, the `update` function will be invoked with the results of the
   * discovery.
   */
  private async launchDiscovery(): Promise<void> {
    try {
      await this.discover();
    } catch (err) {
      void this.logger.log(
        `${this.name} failed. Reason: ${getErrorMessage(err)}`,
      );
    }

    if (this.restartWhenFinished) {
      // Another refresh request came in while we were still running a previous discovery
      // operation. Since the discovery results we just computed are now stale, we'll launch
      // another discovery operation instead of updating.
      // We want to relaunch discovery regardless of if the initial discovery operation
      // succeeded or failed.
      this.restartWhenFinished = false;
      await this.launchDiscovery();
    }
  }

  /**
   * Overridden by the derived class to spawn the actual discovery operation, returning the results.
   */
  protected abstract discover(): Promise<void>;
}
