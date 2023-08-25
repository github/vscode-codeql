import * as React from "react";
import { useEffect } from "react";
import { MethodModeling } from "./MethodModeling";

export function MethodModelingView(): JSX.Element {
  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        // Nothing to do yet.
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
  }, []);

  return <MethodModeling />;
}
