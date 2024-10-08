import { reportStreamProgress } from "../../../../../src/common/vscode/progress";

describe("helpers", () => {
  it("should report stream progress", () => {
    const progressSpy = jest.fn();
    const max = 1024 * 1024 * 4;
    const firstStep = 1024 * 1024 + 1024 * 600;
    const secondStep = 1024 * 1024 * 2;

    const reportProgress = reportStreamProgress("My prefix", max, progressSpy);

    // now pretend that we have received some messages
    reportProgress(firstStep);
    reportProgress(secondStep);

    expect(progressSpy).toHaveBeenCalledTimes(3);
    expect(progressSpy).toHaveBeenCalledWith({
      step: 0,
      maxStep: max,
      message: "My prefix [0.0 MB of 4.0 MB]",
    });
    expect(progressSpy).toHaveBeenCalledWith({
      step: firstStep,
      maxStep: max,
      message: "My prefix [1.6 MB of 4.0 MB]",
    });
    expect(progressSpy).toHaveBeenCalledWith({
      step: firstStep + secondStep,
      maxStep: max,
      message: "My prefix [3.6 MB of 4.0 MB]",
    });
  });

  it("should report stream progress when total bytes unknown", () => {
    const progressSpy = jest.fn();
    const reportProgress = reportStreamProgress(
      "My prefix",
      undefined,
      progressSpy,
    );

    // It should not report progress when calling the callback
    reportProgress(100);

    expect(progressSpy).toHaveBeenCalledTimes(1);
    expect(progressSpy).toHaveBeenCalledWith({
      step: 1,
      maxStep: 2,
      message: "My prefix (Size unknown)",
    });
  });
});
