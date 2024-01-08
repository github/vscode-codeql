import type { Preview } from "@storybook/react";
import { themes } from "@storybook/theming";
import { action } from "@storybook/addon-actions";

// Allow all stories/components to use Codicons
import "@vscode/codicons/dist/codicon.css";

import type { VsCodeApi } from "../src/view/vscode-api";

declare global {
  interface Window {
    acquireVsCodeApi: () => VsCodeApi;
  }
}

window.acquireVsCodeApi = () => ({
  postMessage: action("post-vscode-message"),
  setState: action("set-vscode-state"),
});

// https://storybook.js.org/docs/react/configure/overview#configure-story-rendering
const preview: Preview = {
  parameters: {
    // All props starting with `on` will automatically receive an action as a prop
    actions: { argTypesRegex: "^on[A-Z].*" },
    // All props matching these names will automatically get the correct control
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    // Use a dark theme to be aligned with VSCode
    docs: {
      theme: themes.dark,
    },
    backgrounds: {
      // The background is injected by our theme CSS files
      disable: true,
    },
  },
};

export default preview;
