import { Logger } from "../../src/common";

export function createMockLogger(): Logger {
  return {
    log: jest.fn(() => Promise.resolve()),
    show: jest.fn(),
  };
}
