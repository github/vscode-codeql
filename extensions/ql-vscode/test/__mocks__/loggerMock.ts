import { NotificationLogger } from "../../src/common";

export function createMockLogger(): NotificationLogger {
  return {
    log: jest.fn(() => Promise.resolve()),
    show: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
  };
}
