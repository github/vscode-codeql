import { CachedOperation } from "../../../src/language-support/contextual/cached-operation";

describe("CachedOperation", () => {
  it("caches results and tracks cached keys with has()", async () => {
    const operation = jest.fn(async (key: string, suffix: string) => {
      return `${key}:${suffix}`;
    });
    const cache = new CachedOperation<[string], string>(operation);

    expect(cache.has("a")).toBe(false);

    const res1 = await cache.get("a", "1");
    expect(res1).toBe("a:1");
    expect(cache.has("a")).toBe(true);
    expect(operation).toHaveBeenCalledTimes(1);

    const res2 = await cache.get("a", "2");
    expect(res2).toBe("a:1");
    expect(operation).toHaveBeenCalledTimes(1);

    cache.reset();
    expect(cache.has("a")).toBe(false);

    const res3 = await cache.get("a", "2");
    expect(res3).toBe("a:2");
    expect(cache.has("a")).toBe(true);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
