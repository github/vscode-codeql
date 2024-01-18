/**
 * This module contains instantiated loggers to use in the extension.
 */

import { OutputChannelLogger } from "./output-channel-logger";

// Global logger for the extension.
export const extLogger = new OutputChannelLogger("CodeQL Extension Log");

// Logger for messages from the query server.
export const queryServerLogger = new OutputChannelLogger("CodeQL Query Server");

// Logger for messages from the language server.
export const languageServerLogger = new OutputChannelLogger(
  "CodeQL Language Server",
);

// Logger for messages from tests.
export const testLogger = new OutputChannelLogger("CodeQL Tests");
