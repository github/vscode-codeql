import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { MethodModeling } from "./MethodModeling";
import { getModelingStatus } from "../../model-editor/shared/modeling-status";
import { Method, canMethodBeModeled } from "../../model-editor/method";
import { ToMethodModelingMessage } from "../../common/interface-types";
import { assertNever } from "../../common/helpers-pure";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { vscode } from "../vscode-api";
import { NotInModelingMode } from "./NotInModelingMode";
import { NoMethodSelected } from "./NoMethodSelected";
import { MethodModelingPanelViewState } from "../../model-editor/shared/view-state";
import { MethodAlreadyModeled } from "./MethodAlreadyModeled";

type Props = {
  initialViewState?: MethodModelingPanelViewState;
};

export function MethodModelingView({ initialViewState }: Props): JSX.Element {
  const [viewState, setViewState] = useState<
    MethodModelingPanelViewState | undefined
  >(initialViewState);
  const [inModelingMode, setInModelingMode] = useState<boolean>(false);

  const [method, setMethod] = useState<Method | undefined>(undefined);

  const [modeledMethods, setModeledMethods] = useState<ModeledMethod[]>([]);

  const [isMethodModified, setIsMethodModified] = useState<boolean>(false);

  const [isModelingInProgress, setIsModelingInProgress] =
    useState<boolean>(false);

  const modelingStatus = useMemo(
    () => getModelingStatus(modeledMethods, isMethodModified),
    [modeledMethods, isMethodModified],
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
          case "setMultipleModeledMethods":
            setModeledMethods(msg.modeledMethods);
            break;
          case "setMethodModified":
            setIsMethodModified(msg.isModified);
            break;
          case "setSelectedMethod":
            setMethod(msg.method);
            setModeledMethods(msg.modeledMethods);
            setIsMethodModified(msg.isModified);
            break;
          case "setInProgress":
            setIsModelingInProgress(msg.inProgress);
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

  if (!inModelingMode || !viewState?.language) {
    return <NotInModelingMode />;
  }

  if (!method) {
    return <NoMethodSelected />;
  }

  if (!canMethodBeModeled(method, modeledMethods, isMethodModified)) {
    return <MethodAlreadyModeled />;
  }

  const onChange = (
    methodSignature: string,
    modeledMethods: ModeledMethod[],
  ) => {
    vscode.postMessage({
      t: "setMultipleModeledMethods",
      methodSignature,
      modeledMethods,
    });
  };

  return (
    <MethodModeling
      language={viewState?.language}
      modelingStatus={modelingStatus}
      method={method}
      modeledMethods={modeledMethods}
      isModelingInProgress={isModelingInProgress}
      onChange={onChange}
    />
  );
}
