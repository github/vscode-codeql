import { window } from "vscode";
import {
  showBinaryChoiceDialog,
  showInformationMessageWithAction,
  showNeverAskAgainDialog,
} from "../../../../../src/common/vscode/dialog";

describe("showBinaryChoiceDialog", () => {
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof window.showInformationMessage
  >;

  beforeEach(() => {
    showInformationMessageSpy = jest
      .spyOn(window, "showInformationMessage")
      .mockResolvedValue(undefined);
  });

  const resolveArg =
    (index: number) =>
    (...args: any[]) =>
      Promise.resolve(args[index]);

  it("should show a binary choice dialog and return `yes`", async () => {
    // pretend user chooses 'yes'
    showInformationMessageSpy.mockImplementationOnce(resolveArg(2));
    const val = await showBinaryChoiceDialog("xxx");
    expect(val).toBe(true);
  });

  it("should show a binary choice dialog and return `no`", async () => {
    // pretend user chooses 'no'
    showInformationMessageSpy.mockImplementationOnce(resolveArg(3));
    const val = await showBinaryChoiceDialog("xxx");
    expect(val).toBe(false);
  });
});

describe("showInformationMessageWithAction", () => {
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof window.showInformationMessage
  >;

  beforeEach(() => {
    showInformationMessageSpy = jest
      .spyOn(window, "showInformationMessage")
      .mockResolvedValue(undefined);
  });

  const resolveArg =
    (index: number) =>
    (...args: any[]) =>
      Promise.resolve(args[index]);

  it("should show an info dialog and confirm the action", async () => {
    // pretend user chooses to run action
    showInformationMessageSpy.mockImplementationOnce(resolveArg(1));
    const val = await showInformationMessageWithAction("xxx", "yyy");
    expect(val).toBe(true);
  });

  it("should show an action dialog and avoid choosing the action", async () => {
    // pretend user does not choose to run action
    showInformationMessageSpy.mockResolvedValueOnce(undefined);
    const val = await showInformationMessageWithAction("xxx", "yyy");
    expect(val).toBe(false);
  });
});

describe("showNeverAskAgainDialog", () => {
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof window.showInformationMessage
  >;

  beforeEach(() => {
    showInformationMessageSpy = jest
      .spyOn(window, "showInformationMessage")
      .mockResolvedValue(undefined);
  });

  const resolveArg =
    (index: number) =>
    (...args: any[]) =>
      Promise.resolve(args[index]);

  const title =
    "We've noticed you don't have a CodeQL pack available to analyze this database. Can we set up a query pack for you?";

  it("should show a ternary choice dialog and return `Yes`", async () => {
    // pretend user chooses 'Yes'
    const yesItem = resolveArg(2);
    showInformationMessageSpy.mockImplementationOnce(yesItem);

    const answer = await showNeverAskAgainDialog(title);
    expect(answer).toBe("Yes");
  });

  it("should show a ternary choice dialog and return `No`", async () => {
    // pretend user chooses 'No'
    const noItem = resolveArg(3);
    showInformationMessageSpy.mockImplementationOnce(noItem);

    const answer = await showNeverAskAgainDialog(title);
    expect(answer).toBe("No");
  });

  it("should show a ternary choice dialog and return `No, and never ask me again`", async () => {
    // pretend user chooses 'No, and never ask me again'
    const neverAskAgainItem = resolveArg(4);
    showInformationMessageSpy.mockImplementationOnce(neverAskAgainItem);

    const answer = await showNeverAskAgainDialog(title);
    expect(answer).toBe("No, and never ask me again");
  });
});
