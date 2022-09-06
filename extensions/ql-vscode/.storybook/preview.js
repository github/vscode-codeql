import { themes } from '@storybook/theming';

// Allow all stories/components to use Codicons
import '@vscode/codicons/dist/codicon.css';

import '../src/stories/vscode-theme.css';

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
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
  },
  options: {
    storySort: {
      order: ['WebView UI Toolkit', 'MRVA'],
    },
  },
};
