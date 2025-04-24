// Store this on the window so we can mock it
window.vsCodeApi = {
  postMessage: vi.fn(),
  setState: vi.fn(),
};

window.acquireVsCodeApi = () => window.vsCodeApi;
