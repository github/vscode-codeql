// A plain data structure containing just the information you'd want
// to get out of a `QLConfiguration`, without any of the on-change
// callback plumbing. This allows avoiding the dependency on `vscode`
// for testing.

export type QLConfigurationData = {
  numThreads: number,
  qlDistributionPath: string,
  javaCommand: string,
};
