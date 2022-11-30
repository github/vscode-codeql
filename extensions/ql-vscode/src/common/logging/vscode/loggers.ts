import { OutputChannelLogger } from "./output-channel-logger";

/** The global logger for the extension. */
export const logger = new OutputChannelLogger("CodeQL Extension Log");

/** The logger for messages from the query server. */
export const queryServerLogger = new OutputChannelLogger("CodeQL Query Server");

/** The logger for messages from the language server. */
export const ideServerLogger = new OutputChannelLogger(
  "CodeQL Language Server",
);

/** The logger for messages from tests. */
export const testLogger = new OutputChannelLogger("CodeQL Tests");
