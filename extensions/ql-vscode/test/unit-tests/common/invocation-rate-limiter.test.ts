import type { Memento } from "vscode";
import { InvocationRateLimiter } from "../../../src/common/invocation-rate-limiter";

describe("Invocation rate limiter", () => {
  // 1 January 2020
  let currentUnixTime = 1577836800;

  function createDate(dateString?: string): Date {
    if (dateString) {
      return new Date(dateString);
    }
    const numMillisecondsPerSecond = 1000;
    return new Date(currentUnixTime * numMillisecondsPerSecond);
  }

  function createInvocationRateLimiter<T>(
    funcIdentifier: string,
    func: () => Promise<T>,
  ): InvocationRateLimiter<T> {
    return new InvocationRateLimiter(
      new MockMemento(),
      funcIdentifier,
      func,
      (s) => createDate(s),
    );
  }

  class MockMemento implements Memento {
    keys(): readonly string[] {
      throw new Error("Method not implemented.");
    }
    map = new Map<any, any>();

    /**
     * Return a value.
     *
     * @param key A string.
     * @param defaultValue A value that should be returned when there is no
     * value (`undefined`) with the given key.
     * @return The stored value or the defaultValue.
     */
    get<T>(key: string, defaultValue?: T): T {
      return this.map.has(key) ? this.map.get(key) : defaultValue;
    }

    /**
     * Store a value. The value must be JSON-stringifyable.
     *
     * @param key A string.
     * @param value A value. MUST not contain cyclic references.
     */
    async update(key: string, value: any): Promise<void> {
      this.map.set(key, value);
    }
  }

  it("initially invokes function", async () => {
    let numTimesFuncCalled = 0;
    const invocationRateLimiter = createInvocationRateLimiter(
      "funcid",
      async () => {
        numTimesFuncCalled++;
      },
    );
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
    expect(numTimesFuncCalled).toBe(1);
  });

  it("doesn't invoke function again if no time has passed", async () => {
    let numTimesFuncCalled = 0;
    const invocationRateLimiter = createInvocationRateLimiter(
      "funcid",
      async () => {
        numTimesFuncCalled++;
      },
    );
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
    expect(numTimesFuncCalled).toBe(1);
  });

  it("doesn't invoke function again if requested time since last invocation hasn't passed", async () => {
    let numTimesFuncCalled = 0;
    const invocationRateLimiter = createInvocationRateLimiter(
      "funcid",
      async () => {
        numTimesFuncCalled++;
      },
    );
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
    currentUnixTime += 1;
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(2);
    expect(numTimesFuncCalled).toBe(1);
  });

  it("invokes function again immediately if requested time since last invocation is 0 seconds", async () => {
    let numTimesFuncCalled = 0;
    const invocationRateLimiter = createInvocationRateLimiter(
      "funcid",
      async () => {
        numTimesFuncCalled++;
      },
    );
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(0);
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(0);
    expect(numTimesFuncCalled).toBe(2);
  });

  it("invokes function again after requested time since last invocation has elapsed", async () => {
    let numTimesFuncCalled = 0;
    const invocationRateLimiter = createInvocationRateLimiter(
      "funcid",
      async () => {
        numTimesFuncCalled++;
      },
    );
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(1);
    currentUnixTime += 1;
    await invocationRateLimiter.invokeFunctionIfIntervalElapsed(1);
    expect(numTimesFuncCalled).toBe(2);
  });

  it("invokes functions with different rate limiters", async () => {
    let numTimesFuncACalled = 0;
    const invocationRateLimiterA = createInvocationRateLimiter(
      "funcid",
      async () => {
        numTimesFuncACalled++;
      },
    );
    let numTimesFuncBCalled = 0;
    const invocationRateLimiterB = createInvocationRateLimiter(
      "funcid",
      async () => {
        numTimesFuncBCalled++;
      },
    );
    await invocationRateLimiterA.invokeFunctionIfIntervalElapsed(100);
    await invocationRateLimiterB.invokeFunctionIfIntervalElapsed(100);
    expect(numTimesFuncACalled).toBe(1);
    expect(numTimesFuncBCalled).toBe(1);
  });
});
