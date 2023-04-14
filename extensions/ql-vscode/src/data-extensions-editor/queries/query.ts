export type Query = {
  mainQuery: string;
  dependencies?: {
    [filename: string]: string;
  };
};
