import { asError } from "../../common/helpers-pure";

/**
 * A type that wraps the cached operation function to avoid the use of
 * any in the args.
 */
type CachedOperationFunction<F> = F extends (
  t: string,
  ...args: infer A
) => Promise<infer U>
  ? (t: string, ...args: A) => Promise<U>
  : never;

/**
 * The value to store in the cache for a cached operation.
 */
type CachedOperationValue<
  F extends (t: string, ...args: unknown[]) => Promise<unknown>,
> = Awaited<ReturnType<F>>;

/**
 * All parameters of a function except the first one, which must be a string.
 */
type CachedOperationArgs<
  F extends (t: string, ...args: unknown[]) => Promise<unknown>,
> = Parameters<F> extends [string, ...infer T] ? T : never;

/**
 * A cached mapping from args of type [string, S] to a value of type Promise<U>.
 *
 * F1 needs to be supplied as the type of the function that is being cached,
 * for example by using `typeof myFunction`. F1 always accepts all arguments,
 * but if it doesn't match the shape of `CachedOperationFunction` then the constructor
 * argument will be inferred as `never`. This is because this is the only way to prevent
 * the use of any in the `args` parameter of the `extends` type.
 */
export class CachedOperation<
  F1,
  F extends CachedOperationFunction<F1> = CachedOperationFunction<F1>,
> {
  private readonly cached: Map<string, CachedOperationValue<F>>;
  private readonly lru: string[];
  private readonly inProgressCallbacks: Map<
    string,
    Array<[(u: CachedOperationValue<F>) => void, (reason?: Error) => void]>
  >;

  constructor(
    private readonly operation: F,
    private cacheSize = 100,
  ) {
    this.operation = operation;
    this.lru = [];
    this.inProgressCallbacks = new Map<
      string,
      Array<[(u: CachedOperationValue<F>) => void, (reason?: Error) => void]>
    >();
    this.cached = new Map();
  }

  async get(
    t: string,
    ...args: CachedOperationArgs<F>
  ): Promise<CachedOperationValue<F>> {
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
      return await new Promise<CachedOperationValue<F>>((resolve, reject) => {
        inProgressCallback.push([resolve, reject]);
      });
    }

    // Otherwise compute the new value, but leave a callback to allow sharing work
    const callbacks: Array<
      [(u: CachedOperationValue<F>) => void, (reason?: Error) => void]
    > = [];
    this.inProgressCallbacks.set(t, callbacks);
    try {
      const result = (await this.operation(
        t,
        ...args,
      )) as CachedOperationValue<F>;
      callbacks.forEach((f) => f[0](result));
      this.inProgressCallbacks.delete(t);
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
}
