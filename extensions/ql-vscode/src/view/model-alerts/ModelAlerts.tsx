import { useEffect } from "react";

export function ModelAlerts(): React.JSX.Element {
  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      // sanitize origin
      const origin = evt.origin.replace(/\n|\r/g, "");
      console.error(`Invalid event origin ${origin}`);
    };
    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, []);

  return <>hello world</>;
}
