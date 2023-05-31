import * as React from "react";
import { WebviewDefinition } from "../webview-definition";
import { PerformanceEditorViewApp } from "./performance";

const definition: WebviewDefinition = {
  component: <PerformanceEditorViewApp />,
};

export default definition;
