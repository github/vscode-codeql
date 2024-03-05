import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { vscode } from "./vscode-api";

import { registerUnhandledErrorListener } from "./common/errors";
import type { WebviewDefinition } from "./webview-definition";

import compareView from "./compare";
import dataFlowPathsView from "./data-flow-paths";
import methodModelingView from "./method-modeling";
import modelEditorView from "./model-editor";
import resultsView from "./results";
import variantAnalysisView from "./variant-analysis";
import modelAlertsView from "./model-alerts";

// Allow all views to use Codicons
import "@vscode/codicons/dist/codicon.css";

const views: Record<string, WebviewDefinition> = {
  compare: compareView,
  "data-flow-paths": dataFlowPathsView,
  "method-modeling": methodModelingView,
  "model-editor": modelEditorView,
  results: resultsView,
  "variant-analysis": variantAnalysisView,
  "model-alerts": modelAlertsView,
};

const render = () => {
  registerUnhandledErrorListener();

  const element = document.getElementById("root");

  if (!element) {
    console.error('Could not find element with id "root"');
    return;
  }

  const viewName = element.dataset.view;
  if (!viewName) {
    console.error("Could not find view name in data-view attribute");
    return;
  }

  const view: WebviewDefinition = views[viewName];
  if (!view) {
    console.error(`Could not find view with name "${viewName}"`);
    return;
  }

  const root = createRoot(element);
  root.render(
    <StrictMode>
      <div ref={() => vscode.postMessage({ t: "viewLoaded", viewName })}>
        {view.component}
      </div>
    </StrictMode>,
  );
};

render();
