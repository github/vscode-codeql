import 'chai';
import 'chai/register-should';
import 'sinon-chai';
import * as sinon from 'sinon';
import 'mocha';

import { DisposableObject } from '../../src/pure/disposable-object';
import { expect } from 'chai';

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

    expect(disposable1.dispose).to.have.been.called;
    expect(disposable2.dispose).to.have.been.called;
    expect(disposable3.dispose).to.have.been.called;

    // pushed items must be called in reverse order
    sinon.assert.callOrder(disposable2.dispose, disposable1.dispose);

    // now that disposableObject has been disposed, subsequent disposals are
    // no-ops
    disposable1.dispose.resetHistory();
    disposable2.dispose.resetHistory();
    disposable3.dispose.resetHistory();

    disposableObject.dispose();

    expect(disposable1.dispose).not.to.have.been.called;
    expect(disposable2.dispose).not.to.have.been.called;
    expect(disposable3.dispose).not.to.have.been.called;
  });

  it('should dispose and stop tracking objects', () => {
    disposableObject.track(disposable1);
    disposableObject.disposeAndStopTracking(disposable1);

    expect(disposable1.dispose).to.have.been.called;
    disposable1.dispose.resetHistory();

    disposableObject.dispose();
    expect(disposable1.dispose).not.to.have.been.called;
  });

  it('should avoid disposing an object that is not tracked', () => {
    disposableObject.push(disposable1);
    disposableObject.disposeAndStopTracking(disposable1);

    expect(disposable1.dispose).not.to.have.been.called;

    disposableObject.dispose();
    expect(disposable1.dispose).to.have.been.called;
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

    expect(disposable1.dispose).to.have.been.called;
    expect(disposable2.dispose).not.to.have.been.called;
    expect(disposable3.dispose).to.have.been.called;
    expect(disposable4.dispose).not.to.have.been.called;

    // now that disposableObject has been disposed, subsequent disposals are
    // no-ops
    disposable1.dispose.resetHistory();
    disposable2.dispose.resetHistory();
    disposable3.dispose.resetHistory();
    disposable4.dispose.resetHistory();

    disposableObject.dispose();

    expect(disposable1.dispose).not.to.have.been.called;
    expect(disposable2.dispose).not.to.have.been.called;
    expect(disposable3.dispose).not.to.have.been.called;
    expect(disposable4.dispose).not.to.have.been.called;
  });

  class MyDisposableObject extends DisposableObject {
    constructor() {
      super();
    }
  }
});
