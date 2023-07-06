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

    expect(disposable1.dispose).toBeCalled();
    expect(disposable2.dispose).toBeCalled();
    expect(disposable3.dispose).toBeCalled();

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

    expect(disposable1.dispose).not.toBeCalled();
    expect(disposable2.dispose).not.toBeCalled();
    expect(disposable3.dispose).not.toBeCalled();
  });

  it("should dispose and stop tracking objects", () => {
    disposableObject.track(disposable1);
    disposableObject.disposeAndStopTracking(disposable1);

    expect(disposable1.dispose).toBeCalled();
    disposable1.dispose.mockClear();

    disposableObject.dispose();
    expect(disposable1.dispose).not.toBeCalled();
  });

  it("should avoid disposing an object that is not tracked", () => {
    disposableObject.push(disposable1);
    disposableObject.disposeAndStopTracking(disposable1);

    expect(disposable1.dispose).not.toBeCalled();

    disposableObject.dispose();
    expect(disposable1.dispose).toBeCalled();
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

    expect(disposable1.dispose).toBeCalled();
    expect(disposable2.dispose).not.toBeCalled();
    expect(disposable3.dispose).toBeCalled();
    expect(disposable4.dispose).not.toBeCalled();

    // now that disposableObject has been disposed, subsequent disposals are
    // no-ops
    disposable1.dispose.mockClear();
    disposable2.dispose.mockClear();
    disposable3.dispose.mockClear();
    disposable4.dispose.mockClear();

    disposableObject.dispose();

    expect(disposable1.dispose).not.toBeCalled();
    expect(disposable2.dispose).not.toBeCalled();
    expect(disposable3.dispose).not.toBeCalled();
    expect(disposable4.dispose).not.toBeCalled();
  });

  class MyDisposableObject extends DisposableObject {
    constructor() {
      super();
    }
  }
});
