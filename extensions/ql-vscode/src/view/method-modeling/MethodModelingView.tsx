import * as React from "react";
import { useEffect } from "react";
import { MethodModeling } from "./MethodModeling";
import { ModelingStatus } from "../model-editor/ModelingStatusIndicator";
import { ExternalApiUsage } from "../../model-editor/external-api-usage";

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
  const externalApiUsage: ExternalApiUsage = {
    library: "sql2o",
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Connection#createQuery(String)",
    packageName: "org.sql2o",
    typeName: "Connection",
    methodName: "createQuery",
    methodParameters: "(String)",
    supported: true,
    supportedType: "summary",
    usages: [],
  };
  return (
    <MethodModeling
      modelingStatus={modelingStatus}
      externalApiUsage={externalApiUsage}
    />
  );
}
