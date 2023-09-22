import * as React from "react";
import { useEffect, useState } from "react";
import { MethodModeling } from "./MethodModeling";
import { ModelingStatus } from "../model-editor/ModelingStatusIndicator";
import { Method } from "../../model-editor/method";
import { ToMethodModelingMessage } from "../../common/interface-types";
import { assertNever } from "../../common/helpers-pure";
import { ModeledMethod } from "../../model-editor/modeled-method";

export function MethodModelingView(): JSX.Element {
  const [method, setMethod] = useState<Method | undefined>(undefined);

  const [modeledMethod, setModeledMethod] = React.useState<
    ModeledMethod | undefined
  >(undefined);

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

  // For now we just store the updated method in the state but soon
  // we'll need to send it back to the other views.
  const onChange = (method: Method, modeledMethod: ModeledMethod) => {
    setModeledMethod(modeledMethod);
  };

  return (
    <MethodModeling
      modelingStatus={modelingStatus}
      method={method}
      modeledMethod={modeledMethod}
      onChange={onChange}
    />
  );
}
