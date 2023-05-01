import { act } from "@testing-library/react";

/** Helper function used in tests */
export async function postMessage<T>(msg: T): Promise<void> {
  await act(async () => {
    // window.postMessage doesn't set the origin correctly, see
    // https://github.com/jsdom/jsdom/issues/2745
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: msg,
      }),
    );

    // The event is dispatched asynchronously, so we need to wait for it to be handled.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
