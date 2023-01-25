import { QueryHistoryInfo } from "../../../src/query-history/query-history-info";

export function shuffleHistoryItems(history: QueryHistoryInfo[]) {
  return history.sort(() => Math.random() - 0.5);
}
