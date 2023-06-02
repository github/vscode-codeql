export type Query = {
  /**
   * The main query.
   *
   * It should select all usages of external APIs, and return the following result pattern:
   * - usage: the usage of the external API. This is an entity.
   * - apiName: the name of the external API. This is a string.
   * - supported: whether the external API is supported by the extension. This should be a string representation of a boolean to satify the result pattern for a problem query.
   * - "supported": a string literal. This is required to make the query a valid problem query.
   */
  mainQuery: string;
  dependencies?: {
    [filename: string]: string;
  };
};
