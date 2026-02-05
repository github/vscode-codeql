// Mock for react-dom/test-utils for React 19 compatibility
// In React 19, react-dom/test-utils is deprecated and act was moved to the react package.
const { act } = require("react");

module.exports = {
  act,
};
