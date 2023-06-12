import { reportStreamProgress } from "../../../src/common/vscode/progress";

describe("helpers", () => {
  it("should report stream progress", () => {
    const progressSpy = jest.fn();
    const mockReadable = {
      on: jest.fn(),
    };
    const max = 1024 * 1024 * 4;
    const firstStep = 1024 * 1024 + 1024 * 600;
    const secondStep = 1024 * 1024 * 2;

    (reportStreamProgress as any)(mockReadable, "My prefix", max, progressSpy);

    // now pretend that we have received some messages
    const listener = mockReadable.on.mock.calls[0][1] as (data: any) => void;
    listener({ length: firstStep });
    listener({ length: secondStep });

    expect(progressSpy).toBeCalledTimes(3);
    expect(progressSpy).toBeCalledWith({
      step: 0,
      maxStep: max,
      message: "My prefix [0.0 MB of 4.0 MB]",
    });
    expect(progressSpy).toBeCalledWith({
      step: firstStep,
      maxStep: max,
      message: "My prefix [1.6 MB of 4.0 MB]",
    });
    expect(progressSpy).toBeCalledWith({
      step: firstStep + secondStep,
      maxStep: max,
      message: "My prefix [3.6 MB of 4.0 MB]",
    });
  });

  it("should report stream progress when total bytes unknown", () => {
    const progressSpy = jest.fn();
    const mockReadable = {
      on: jest.fn(),
    };
    (reportStreamProgress as any)(
      mockReadable,
      "My prefix",
      undefined,
      progressSpy,
    );

    // There are no listeners registered to this readable
    expect(mockReadable.on).not.toBeCalled();

    expect(progressSpy).toBeCalledTimes(1);
    expect(progressSpy).toBeCalledWith({
      step: 1,
      maxStep: 2,
      message: "My prefix (Size unknown)",
    });
  });
});
