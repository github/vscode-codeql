export type Query = {
  mainQuery: string;
  usagesQuery: string;
  dependencies?: {
    [filename: string]: string;
  };
};
