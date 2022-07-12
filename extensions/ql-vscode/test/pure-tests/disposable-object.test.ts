import 'chai';
import 'chai/register-should';
import 'sinon-chai';
import * as sinon from 'sinon';

import { DisposableObject } from '../../src/pure/disposable-object';

describe('DisposableObject and DisposeHandler', () => {

  let disposable1: { dispose: sinon.SinonSpy };
  let disposable2: { dispose: sinon.SinonSpy };
  let disposable3: { dispose: sinon.SinonSpy };
  let disposable4: { dispose: sinon.SinonSpy };
  let disposableObject: any;
  let nestedDisposableObject: any;
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.restore();
    disposable1 = { dispose: sandbox.spy() };
    disposable2 = { dispose: sandbox.spy() };
    disposable3 = { dispose: sandbox.spy() };
    disposable4 = { dispose: sandbox.spy() };

    disposableObject = new MyDisposableObject();
    nestedDisposableObject = new MyDisposableObject();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should dispose tracked and pushed objects', () => {
    disposableObject.push(disposable1);
    disposableObject.push(disposable2);
    disposableObject.track(nestedDisposableObject);
    nestedDisposableObject.track(disposable3);

    disposableObject.dispose();

    expect(disposable1.dispose).toBeCalled();
    expect(disposable2.dispose).toBeCalled();
    expect(disposable3.dispose).toBeCalled();

    // pushed items must be called in reverse order
    sinon.assert.callOrder(disposable2.dispose, disposable1.dispose);

    // now that disposableObject has been disposed, subsequent disposals are
    // no-ops
    disposable1.dispose.resetHistory();
    disposable2.dispose.resetHistory();
    disposable3.dispose.resetHistory();

    disposableObject.dispose();

    expect(disposable1.dispose).not.toBeCalled();
    expect(disposable2.dispose).not.toBeCalled();
    expect(disposable3.dispose).not.toBeCalled();
  });

  it('should dispose and stop tracking objects', () => {
    disposableObject.track(disposable1);
    disposableObject.disposeAndStopTracking(disposable1);

    expect(disposable1.dispose).toBeCalled();
    disposable1.dispose.resetHistory();

    disposableObject.dispose();
    expect(disposable1.dispose).not.toBeCalled();
  });

  it('should avoid disposing an object that is not tracked', () => {
    disposableObject.push(disposable1);
    disposableObject.disposeAndStopTracking(disposable1);

    expect(disposable1.dispose).not.toBeCalled();

    disposableObject.dispose();
    expect(disposable1.dispose).toBeCalled();
  });

  it('ahould use a dispose handler', () => {
    const handler = (d: any) => (d === disposable1 || d === disposable3 || d === nestedDisposableObject)
      ? d.dispose(handler)
      : void (0);

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
    disposable1.dispose.resetHistory();
    disposable2.dispose.resetHistory();
    disposable3.dispose.resetHistory();
    disposable4.dispose.resetHistory();

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
