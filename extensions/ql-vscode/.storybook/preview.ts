import { themes } from '@storybook/theming';
import { action } from '@storybook/addon-actions';

// Allow all stories/components to use Codicons
import '@vscode/codicons/dist/codicon.css';

import '../src/stories/vscode-theme.css';

// https://storybook.js.org/docs/react/configure/overview#configure-story-rendering
export const parameters = {
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
    default: 'dark',
    values: [
      {
        name: 'dark',
        value: '#1e1e1e',
      },
    ],
  }
};

(window as any).acquireVsCodeApi = () => ({
  postMessage: action('post-vscode-message')
});
