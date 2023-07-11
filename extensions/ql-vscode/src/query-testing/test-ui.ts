import {
  TestHub,
  TestController,
  TestAdapter,
  TestRunStartedEvent,
  TestRunFinishedEvent,
  TestEvent,
  TestSuiteEvent,
} from "vscode-test-adapter-api";
import { TestTreeNode } from "./test-tree-node";
import { DisposableObject } from "../common/disposable-object";
import { QLTestAdapter } from "./test-adapter";
import { App } from "../common/app";
import { TestManagerBase } from "./test-manager-base";

type VSCodeTestEvent =
  | TestRunStartedEvent
  | TestRunFinishedEvent
  | TestSuiteEvent
  | TestEvent;

/**
 * Test event listener. Currently unused, but left in to keep the plumbing hooked up for future use.
 */
class QLTestListener extends DisposableObject {
  constructor(adapter: TestAdapter) {
    super();

    this.push(adapter.testStates(this.onTestStatesEvent, this));
  }

  private onTestStatesEvent(_e: VSCodeTestEvent): void {
    /**/
  }
}

/**
 * Service that implements all UI and commands for QL tests.
 */
export class TestUIService extends TestManagerBase implements TestController {
  private readonly listeners: Map<TestAdapter, QLTestListener> = new Map();

  public constructor(
    app: App,
    private readonly testHub: TestHub,
  ) {
    super(app);

    testHub.registerTestController(this);
  }

  public dispose(): void {
    this.testHub.unregisterTestController(this);

    super.dispose();
  }

  public registerTestAdapter(adapter: TestAdapter): void {
    this.listeners.set(adapter, new QLTestListener(adapter));
  }

  public unregisterTestAdapter(adapter: TestAdapter): void {
    if (adapter instanceof QLTestAdapter) {
      this.listeners.delete(adapter);
    }
  }

  protected getTestPath(node: TestTreeNode): string {
    return node.info.id;
  }
}
