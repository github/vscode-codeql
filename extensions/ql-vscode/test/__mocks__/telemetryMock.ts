import type { AppTelemetry } from "../../src/common/telemetry";

export function createMockTelemetryReporter(): AppTelemetry {
  return {
    sendCommandUsage: jest.fn(),
    sendUIInteraction: jest.fn(),
    sendError: jest.fn(),
  };
}
