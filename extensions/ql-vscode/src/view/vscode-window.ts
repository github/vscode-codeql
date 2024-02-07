import type { VsCodeApi } from "./vscode-api";

declare global {
  interface Window {
    CSS: {
      supports: () => Promise<boolean>;
    };
    vsCodeApi: VsCodeApi;
    acquireVsCodeApi: () => VsCodeApi;
  }
}
