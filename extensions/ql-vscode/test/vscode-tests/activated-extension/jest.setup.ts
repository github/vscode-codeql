import {
  beforeAllAction,
  beforeEachAction,
} from "../jest.activated-extension.setup";

beforeAll(async () => {
  await beforeAllAction();
});

beforeEach(async () => {
  await beforeEachAction();
});
