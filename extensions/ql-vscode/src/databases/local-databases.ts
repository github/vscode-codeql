export { DatabaseContentsWithDbScheme } from "./local-databases/database-contents";
export {
  DatabaseChangedEvent,
  DatabaseEventKind,
} from "./local-databases/database-events";
export { DatabaseItem } from "./local-databases/database-item";
export { DatabaseManager } from "./local-databases/database-manager";
export { DatabaseResolver } from "./local-databases/database-resolver";

/**
 * databases.ts
 * ------------
 * Managing state of what the current database is, and what other
 * databases have been recently selected.
 *
 * The source of truth of the current state resides inside the
 * `DatabaseManager` class below.
 */
