import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { MethodModeling } from "./MethodModeling";
import { getModelingStatus } from "../../model-editor/shared/modeling-status";
import { Method } from "../../model-editor/method";
import { ToMethodModelingMessage } from "../../common/interface-types";
import { assertNever } from "../../common/helpers-pure";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { vscode } from "../vscode-api";
import { NotInModelingMode } from "./NotInModelingMode";
import { NoMethodSelected } from "./NoMethodSelected";
import { MethodModelingPanelViewState } from "../../model-editor/shared/view-state";

type Props = {
  initialViewState?: MethodModelingPanelViewState;
};

export function MethodModelingView({ initialViewState }: Props): JSX.Element {
  const [viewState, setViewState] = useState<
    MethodModelingPanelViewState | undefined
  >(initialViewState);
  const [inModelingMode, setInModelingMode] = useState<boolean>(false);

  const [method, setMethod] = useState<Method | undefined>(undefined);

  const [modeledMethod, setModeledMethod] = React.useState<
    ModeledMethod | undefined
  >(undefined);

  const [isMethodModified, setIsMethodModified] = useState<boolean>(false);

  const modelingStatus = useMemo(
    () => getModelingStatus(modeledMethod, isMethodModified),
    [modeledMethod, isMethodModified],
  );

  useEffect(() => {
    const listener = (evt: MessageEvent) => {
      if (evt.origin === window.origin) {
        const msg: ToMethodModelingMessage = evt.data;
        switch (msg.t) {
          case "setMethodModelingPanelViewState":
            setViewState(msg.viewState);
            break;
          case "setInModelingMode":
            setInModelingMode(msg.inModelingMode);
            break;
          case "setMethod":
            setMethod(msg.method);
            break;
          case "setModeledMethod":
            setModeledMethod(msg.method);
            break;
          case "setMethodModified":
            setIsMethodModified(msg.isModified);
            break;
          case "setSelectedMethod":
            setMethod(msg.method);
            setModeledMethod(msg.modeledMethod);
            setIsMethodModified(msg.isModified);
            break;
          default:
            assertNever(msg);
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

  if (!inModelingMode) {
    return <NotInModelingMode />;
  }

  if (!method) {
    return <NoMethodSelected />;
  }

  const onChange = (modeledMethod: ModeledMethod) => {
    vscode.postMessage({
      t: "setModeledMethod",
      method: modeledMethod,
    });
  };

  return (
    <MethodModeling
      modelingStatus={modelingStatus}
      method={method}
      modeledMethods={modeledMethod ? [modeledMethod] : []}
      showMultipleModels={viewState?.showMultipleModels}
      onChange={onChange}
    />
  );
}
