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

// Used by Primer React
window.CSS.supports = jest.fn().mockResolvedValue(false);

// Functions that are not implemented in jsdom
window.CSSStyleSheet.prototype.replaceSync = jest
  .fn()
  .mockReturnValue(undefined);
window.ElementInternals.prototype.setFormValue = jest
  .fn()
  .mockReturnValue(undefined);
window.ElementInternals.prototype.setValidity = jest
  .fn()
  .mockReturnValue(undefined);
window.HTMLSlotElement.prototype.assignedElements = jest
  .fn()
  .mockReturnValue([]);

// Store this on the window so we can mock it
window.vsCodeApi = {
  postMessage: jest.fn(),
  setState: jest.fn(),
};

window.acquireVsCodeApi = () => window.vsCodeApi;
