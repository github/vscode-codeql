import type { RedactableError } from "./errors";

export interface AppTelemetry {
  sendCommandUsage(name: string, executionTime: number, error?: Error): void;
  sendUIInteraction(name: string): void;
  sendError(
    error: RedactableError,
    extraProperties?: { [key: string]: string },
  ): void;
}
