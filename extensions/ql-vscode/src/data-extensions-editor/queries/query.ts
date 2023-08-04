export type Query = {
  /**
   * The application query.
   *
   * It should select all usages of external APIs, and return the following result pattern:
   * - usage: the usage of the external API. This is an entity.
   * - apiName: the name of the external API. This is a string.
   * - supported: whether the external API is modeled. This should be a string representation of a boolean to satify the result pattern for a problem query.
   * - "supported": a string literal. This is required to make the query a valid problem query.
   * - libraryName: the name of the library that contains the external API. This is a string and usually the basename of a file.
   * - libraryVersion: the version of the library that contains the external API. This is a string and can be empty if the version cannot be determined.
   * - type: the modeled kind of the method, either "sink", "source", "summary", or "neutral"
   * - "type": a string literal. This is required to make the query a valid problem query.
   * - classification: the classification of the use of the method, either "source", "test", "generated", or "unknown"
   * - "classification: a string literal. This is required to make the query a valid problem query.
   */
  applicationModeQuery: string;
  /**
   * The framework query.
   *
   * It should select all methods that are callable by applications, which is usually all public methods (and constructors).
   * The result pattern should be as follows:
   * - method: the method that is callable by applications. This is an entity.
   * - apiName: the name of the external API. This is a string.
   * - supported: whether this method is modeled. This should be a string representation of a boolean to satify the result pattern for a problem query.
   * - "supported": a string literal. This is required to make the query a valid problem query.
   * - libraryName: an arbitrary string. This is required to make it match the structure of the application query.
   * - libraryVersion: an arbitrary string. This is required to make it match the structure of the application query.
   * - type: the modeled kind of the method, either "sink", "source", "summary", or "neutral"
   * - "type": a string literal. This is required to make the query a valid problem query.
   * - "unknown": a string literal. This is required to make it match the structure of the application query.
   * - "classification: a string literal. This is required to make the query a valid problem query.
   */
  frameworkModeQuery: string;
  dependencies?: {
    [filename: string]: string;
  };
};
