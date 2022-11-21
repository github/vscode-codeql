import "@testing-library/jest-dom";

// https://jestjs.io/docs/26.x/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Store this on the window so we can mock it
(window as any).vsCodeApi = {
  postMessage: jest.fn(),
  setState: jest.fn(),
};

(window as any).acquireVsCodeApi = () => (window as any).vsCodeApi;
