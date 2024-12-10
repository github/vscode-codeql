import { asError } from "../../common/helpers-pure";

/**
 * A cached mapping from strings to a value of type U.
 */
export class CachedOperation<S extends unknown[], U> {
  private readonly operation: (t: string, ...args: S) => Promise<U>;
  private readonly cached: Map<string, U>;
  private readonly lru: string[];
  private generation: number;
  private readonly inProgressCallbacks: Map<
    string,
    Array<[(u: U) => void, (reason?: Error) => void]>
  >;

  constructor(
    operation: (t: string, ...args: S) => Promise<U>,
    private cacheSize = 100,
  ) {
    this.operation = operation;
    this.generation = 0;
    this.lru = [];
    this.inProgressCallbacks = new Map<
      string,
      Array<[(u: U) => void, (reason?: Error) => void]>
    >();
    this.cached = new Map<string, U>();
  }

  async get(t: string, ...args: S): Promise<U> {
    // Try and retrieve from the cache
    const fromCache = this.cached.get(t);
    if (fromCache !== undefined) {
      // Move to end of lru list
      this.lru.push(
        this.lru.splice(
          this.lru.findIndex((v) => v === t),
          1,
        )[0],
      );
      return fromCache;
    }
    // Otherwise check if in progress
    const inProgressCallback = this.inProgressCallbacks.get(t);
    if (inProgressCallback !== undefined) {
      // If so wait for it to resolve
      return await new Promise((resolve, reject) => {
        inProgressCallback.push([resolve, reject]);
      });
    }
    const origGeneration = this.generation;
    // Otherwise compute the new value, but leave a callback to allow sharing work
    const callbacks: Array<[(u: U) => void, (reason?: Error) => void]> = [];
    this.inProgressCallbacks.set(t, callbacks);
    try {
      const result = await this.operation(t, ...args);
      callbacks.forEach((f) => f[0](result));
      this.inProgressCallbacks.delete(t);
      if (this.generation !== origGeneration) {
        // Cache was reset in the meantime so don't trust this
        // result enough to cache it.
        return result;
      }
      if (this.lru.length > this.cacheSize) {
        const toRemove = this.lru.shift()!;
        this.cached.delete(toRemove);
      }
      this.lru.push(t);
      this.cached.set(t, result);
      return result;
    } catch (e) {
      // Rethrow error on all callbacks
      callbacks.forEach((f) => f[1](asError(e)));
      throw e;
    } finally {
      this.inProgressCallbacks.delete(t);
    }
  }

  reset() {
    this.cached.clear();
    this.lru.length = 0;
    this.generation++;
    this.inProgressCallbacks.clear();
  }
}
