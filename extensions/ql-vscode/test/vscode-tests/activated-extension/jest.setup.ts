import {
  afterAllAction,
  beforeAllAction,
  beforeEachAction,
} from "../jest.activated-extension.setup";

beforeAll(async () => {
  await beforeAllAction();
}, 20_000);

beforeEach(async () => {
  await beforeEachAction();
});

afterAll(async () => {
  await afterAllAction();
});
