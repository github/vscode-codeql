import { env } from "vscode";

(env as any).openExternal = () => {
  /**/
};

afterAll(() => {
  jest.restoreAllMocks();
});
