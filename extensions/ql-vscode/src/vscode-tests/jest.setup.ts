import { afterEach, jest } from '@jest/globals';

// import { env } from 'vscode';

// (env as any).openExternal = () => { /**/ };

afterEach(() => {
  jest.restoreAllMocks();
});
