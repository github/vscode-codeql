import { renderHook } from "@testing-library/react";
import { useEffectEvent } from "../useEffectEvent";

describe("useEffectEvent", () => {
  it("does not change reference when changing the callback function", () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    const { result, rerender } = renderHook(
      (callback) => useEffectEvent(callback),
      {
        initialProps: callback1,
      },
    );

    const callbackResult = result.current;

    rerender();

    expect(result.current).toBe(callbackResult);

    rerender(callback2);

    expect(result.current).toBe(callbackResult);
  });
});
