import { DisposableObject } from "../../../src/common/disposable-object";

describe("DisposableObject and DisposeHandler", () => {
  const disposable1 = {
    dispose: jest.fn(),
  };
  const disposable2 = {
    dispose: jest.fn(),
  };
  const disposable3 = {
    dispose: jest.fn(),
  };
  const disposable4 = {
    dispose: jest.fn(),
  };
  let disposableObject: any;
  let nestedDisposableObject: any;

  beforeEach(() => {
    disposable1.dispose.mockClear();
    disposable2.dispose.mockClear();
    disposable3.dispose.mockClear();
    disposable4.dispose.mockClear();

    disposableObject = new MyDisposableObject();
    nestedDisposableObject = new MyDisposableObject();
  });

  it("should dispose tracked and pushed objects", () => {
    disposableObject.push(disposable1);
    disposableObject.push(disposable2);
    disposableObject.track(nestedDisposableObject);
    nestedDisposableObject.track(disposable3);

    disposableObject.dispose();

    expect(disposable1.dispose).toHaveBeenCalled();
    expect(disposable2.dispose).toHaveBeenCalled();
    expect(disposable3.dispose).toHaveBeenCalled();

    // pushed items must be called in reverse order
    expect(disposable2.dispose.mock.invocationCallOrder[0]).toBeLessThan(
      disposable1.dispose.mock.invocationCallOrder[0],
    );

    // now that disposableObject has been disposed, subsequent disposals are
    // no-ops
    disposable1.dispose.mockClear();
    disposable2.dispose.mockClear();
    disposable3.dispose.mockClear();

    disposableObject.dispose();

    expect(disposable1.dispose).not.toHaveBeenCalled();
    expect(disposable2.dispose).not.toHaveBeenCalled();
    expect(disposable3.dispose).not.toHaveBeenCalled();
  });

  it("should dispose and stop tracking objects", () => {
    disposableObject.track(disposable1);
    disposableObject.disposeAndStopTracking(disposable1);

    expect(disposable1.dispose).toHaveBeenCalled();
    disposable1.dispose.mockClear();

    disposableObject.dispose();
    expect(disposable1.dispose).not.toHaveBeenCalled();
  });

  it("should avoid disposing an object that is not tracked", () => {
    disposableObject.push(disposable1);
    disposableObject.disposeAndStopTracking(disposable1);

    expect(disposable1.dispose).not.toHaveBeenCalled();

    disposableObject.dispose();
    expect(disposable1.dispose).toHaveBeenCalled();
  });

  it("ahould use a dispose handler", () => {
    const handler = (d: any) =>
      d === disposable1 || d === disposable3 || d === nestedDisposableObject
        ? d.dispose(handler)
        : void 0;

    disposableObject.push(disposable1);
    disposableObject.push(disposable2);
    disposableObject.track(nestedDisposableObject);
    nestedDisposableObject.track(disposable3);
    nestedDisposableObject.track(disposable4);

    disposableObject.dispose(handler);

    expect(disposable1.dispose).toHaveBeenCalled();
    expect(disposable2.dispose).not.toHaveBeenCalled();
    expect(disposable3.dispose).toHaveBeenCalled();
    expect(disposable4.dispose).not.toHaveBeenCalled();

    // now that disposableObject has been disposed, subsequent disposals are
    // no-ops
    disposable1.dispose.mockClear();
    disposable2.dispose.mockClear();
    disposable3.dispose.mockClear();
    disposable4.dispose.mockClear();

    disposableObject.dispose();

    expect(disposable1.dispose).not.toHaveBeenCalled();
    expect(disposable2.dispose).not.toHaveBeenCalled();
    expect(disposable3.dispose).not.toHaveBeenCalled();
    expect(disposable4.dispose).not.toHaveBeenCalled();
  });

  class MyDisposableObject extends DisposableObject {
    constructor() {
      super();
    }
  }
});
