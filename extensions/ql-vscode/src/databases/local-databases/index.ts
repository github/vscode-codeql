export { DatabaseContentsWithDbScheme } from "./database-contents";
export { DatabaseChangedEvent, DatabaseEventKind } from "./database-events";
export { DatabaseItem } from "./database-item";
export { DatabaseManager } from "./database-manager";
export { DatabaseResolver } from "./database-resolver";

/**
 * databases.ts
 * ------------
 * Managing state of what the current database is, and what other
 * databases have been recently selected.
 *
 * The source of truth of the current state resides inside the
 * `DatabaseManager` class below.
 */
