export const sharedExtensiblePredicates = {
  source: "sourceModel",
  sink: "sinkModel",
  summary: "summaryModel",
  neutral: "neutralModel",
};

export const sharedKinds = {
  // https://github.com/github/codeql/blob/0c5ea975a4c4dc5c439b908c006e440cb9bdf926/shared/mad/codeql/mad/ModelValidation.qll#L118-L119
  source: ["local", "remote", "file", "commandargs", "database", "environment"],
  // Bhttps://github.com/github/codeql/blob/0c5ea975a4c4dc5c439b908c006e440cb9bdf926/shared/mad/codeql/mad/ModelValidation.qll#L28-L31
  sink: [
    "code-injection",
    "command-injection",
    "environment-injection",
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
  // https://github.com/github/codeql/blob/0c5ea975a4c4dc5c439b908c006e440cb9bdf926/shared/mad/codeql/mad/ModelValidation.qll#L142-L143
  summary: ["taint", "value"],
  // https://github.com/github/codeql/blob/0c5ea975a4c4dc5c439b908c006e440cb9bdf926/shared/mad/codeql/mad/ModelValidation.qll#L155-L156
  neutral: ["summary", "source", "sink"],
};
