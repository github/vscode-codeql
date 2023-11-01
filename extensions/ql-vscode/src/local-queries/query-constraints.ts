export interface QueryConstraints {
  kind?: string;
  "tags contain"?: string[];
  "tags contain all"?: string[];
  "query filename"?: string;
  "query path"?: string;
}
