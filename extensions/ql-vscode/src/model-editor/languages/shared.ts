export const sharedExtensiblePredicates = {
  source: "sourceModel",
  sink: "sinkModel",
  summary: "summaryModel",
  neutral: "neutralModel",
};

export const sharedKinds = {
  source: ["local", "remote"],
  sink: [
    "code-injection",
    "command-injection",
    "file-content-store",
    "html-injection",
    "js-injection",
    "ldap-injection",
    "log-injection",
    "path-injection",
    "request-forgery",
    "sql-injection",
    "url-redirection",
  ],
  summary: ["taint", "value"],
  neutral: ["summary", "source", "sink"],
};
