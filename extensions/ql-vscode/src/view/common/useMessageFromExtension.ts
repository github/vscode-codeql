import { useEffect } from "react";

/**
 * Invokes the given callback when a message is received from the extension.
 */
export function useMessageFromExtension<T>(
  onEvent: (event: T) => void,
  onEventDependencies: unknown[],
): void {
  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        onEvent(evt.data as T);
      } else {
        // sanitize origin
        const origin = evt.origin.replace(/\n|\r/g, "");
        console.error(`Invalid event origin ${origin}`);
      }
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, onEventDependencies);
}
