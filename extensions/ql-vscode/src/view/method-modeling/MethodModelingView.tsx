import * as React from "react";
import { useEffect, useState } from "react";
import { MethodModeling } from "./MethodModeling";
import { ModelingStatus } from "../model-editor/ModelingStatusIndicator";
import { ExternalApiUsage } from "../../model-editor/external-api-usage";
import { ToMethodModelingMessage } from "../../common/interface-types";
import { assertNever } from "../../common/helpers-pure";

export function MethodModelingView(): JSX.Element {
  const [method, setMethod] = useState<ExternalApiUsage | undefined>(undefined);

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToMethodModelingMessage = evt.data;
        if (msg.t === "setMethod") {
          setMethod(msg.method);
        } else {
          assertNever(msg.t);
        }
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

  if (!method) {
    return <>Select method to model</>;
  }

  const modelingStatus: ModelingStatus = "saved";
  return (
    <MethodModeling modelingStatus={modelingStatus} externalApiUsage={method} />
  );
}
