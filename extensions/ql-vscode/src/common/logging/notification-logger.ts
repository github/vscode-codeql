import type { Logger } from "./logger";

export interface NotificationLogger extends Logger {
  showErrorMessage(message: string): Promise<void>;
  showWarningMessage(message: string): Promise<void>;
  showInformationMessage(message: string): Promise<void>;
}
