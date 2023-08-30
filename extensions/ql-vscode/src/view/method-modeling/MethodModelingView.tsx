import * as React from "react";
import { useEffect } from "react";
import { MethodModeling } from "./MethodModeling";
import { ModelingStatus } from "../model-editor/ModelingStatusIndicator";

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

  const modelingStatus: ModelingStatus = "saved";
  return <MethodModeling modelingStatus={modelingStatus} />;
}
