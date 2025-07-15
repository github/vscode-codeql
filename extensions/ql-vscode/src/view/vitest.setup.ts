// Store this on the window so we can mock it
window.vsCodeApi = {
  postMessage: jest.fn(),
  setState: jest.fn(),
};

window.acquireVsCodeApi = () => window.vsCodeApi;
