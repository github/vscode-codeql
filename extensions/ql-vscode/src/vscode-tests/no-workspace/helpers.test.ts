import { expect } from 'chai';
import 'mocha';
import { ExtensionContext, Memento } from 'vscode';
import * as yaml from 'js-yaml';
import * as tmp from 'tmp';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';

import { getInitialQueryContents, InvocationRateLimiter, isLikelyDbLanguageFolder, reportStreamProgress } from '../../helpers';

describe('helpers', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Invocation rate limiter', () => {
    // 1 January 2020
    let currentUnixTime = 1577836800;

    function createDate(dateString?: string): Date {
      if (dateString) {
        return new Date(dateString);
      }
      const numMillisecondsPerSecond = 1000;
      return new Date(currentUnixTime * numMillisecondsPerSecond);
    }

    function createInvocationRateLimiter<T>(funcIdentifier: string, func: () => Promise<T>): InvocationRateLimiter<T> {
      return new InvocationRateLimiter(new MockExtensionContext(), funcIdentifier, func, s => createDate(s));
    }

    it('initially invokes function', async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter('funcid', async () => {
        numTimesFuncCalled++;
      });
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
      expect(numTimesFuncCalled).to.equal(1);
    });

    it('doesn\'t invoke function again if no time has passed', async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter('funcid', async () => {
        numTimesFuncCalled++;
      });
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
      expect(numTimesFuncCalled).to.equal(1);
    });

    it('doesn\'t invoke function again if requested time since last invocation hasn\'t passed', async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter('funcid', async () => {
        numTimesFuncCalled++;
      });
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(100);
      currentUnixTime += 1;
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(2);
      expect(numTimesFuncCalled).to.equal(1);
    });

    it('invokes function again immediately if requested time since last invocation is 0 seconds', async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter('funcid', async () => {
        numTimesFuncCalled++;
      });
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(0);
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(0);
      expect(numTimesFuncCalled).to.equal(2);
    });

    it('invokes function again after requested time since last invocation has elapsed', async () => {
      let numTimesFuncCalled = 0;
      const invocationRateLimiter = createInvocationRateLimiter('funcid', async () => {
        numTimesFuncCalled++;
      });
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(1);
      currentUnixTime += 1;
      await invocationRateLimiter.invokeFunctionIfIntervalElapsed(1);
      expect(numTimesFuncCalled).to.equal(2);
    });

    it('invokes functions with different rate limiters', async () => {
      let numTimesFuncACalled = 0;
      const invocationRateLimiterA = createInvocationRateLimiter('funcid', async () => {
        numTimesFuncACalled++;
      });
      let numTimesFuncBCalled = 0;
      const invocationRateLimiterB = createInvocationRateLimiter('funcid', async () => {
        numTimesFuncBCalled++;
      });
      await invocationRateLimiterA.invokeFunctionIfIntervalElapsed(100);
      await invocationRateLimiterB.invokeFunctionIfIntervalElapsed(100);
      expect(numTimesFuncACalled).to.equal(1);
      expect(numTimesFuncBCalled).to.equal(1);
    });
  });

  describe('codeql-database.yml tests', () => {
    let dir: tmp.DirResult;
    beforeEach(() => {
      dir = tmp.dirSync();
      const contents = yaml.safeDump({
        primaryLanguage: 'cpp'
      });
      fs.writeFileSync(path.join(dir.name, 'codeql-database.yml'), contents, 'utf8');
    });

    afterEach(() => {
      dir.removeCallback();
    });

    it('should get initial query contents when language is known', () => {
      expect(getInitialQueryContents('cpp', 'hucairz')).to.eq('import cpp\n\nselect ""');
    });

    it('should get initial query contents when dbscheme is known', () => {
      expect(getInitialQueryContents('', 'semmlecode.cpp.dbscheme')).to.eq('import cpp\n\nselect ""');
    });

    it('should get initial query contents when nothing is known', () => {
      expect(getInitialQueryContents('', 'hucairz')).to.eq('select ""');
    });
  });

  it('should find likely db language folders', () => {
    expect(isLikelyDbLanguageFolder('db-javascript')).to.be.true;
    expect(isLikelyDbLanguageFolder('dbnot-a-db')).to.be.false;
  });

  class MockExtensionContext implements ExtensionContext {
    subscriptions: { dispose(): unknown }[] = [];
    workspaceState: Memento = new MockMemento();
    globalState: Memento = new MockMemento();
    extensionPath = '';
    asAbsolutePath(_relativePath: string): string {
      throw new Error('Method not implemented.');
    }
    storagePath = '';
    globalStoragePath = '';
    logPath = '';
  }

  class MockMemento implements Memento {
    map = new Map<any, any>();

    /**
     * Return a value.
     *
     * @param key A string.
     * @param defaultValue A value that should be returned when there is no
     * value (`undefined`) with the given key.
     * @return The stored value or the defaultValue.
     */
    get<T>(key: string, defaultValue?: T): T {
      return this.map.has(key) ? this.map.get(key) : defaultValue;
    }

    /**
     * Store a value. The value must be JSON-stringifyable.
     *
     * @param key A string.
     * @param value A value. MUST not contain cyclic references.
     */
    async update(key: string, value: any): Promise<void> {
      this.map.set(key, value);
    }
  }

  it('should report stream progress', () => {
    const spy = sandbox.spy();
    const mockReadable = {
      on: sandbox.spy()
    };
    const max = 1024 * 1024 * 4;
    const firstStep = (1024 * 1024) + (1024 * 600);
    const secondStep = 1024 * 1024 * 2;

    (reportStreamProgress as any)(mockReadable, 'My prefix', max, spy);

    // now pretend that we have received some messages
    mockReadable.on.getCall(0).args[1]({ length: firstStep });
    mockReadable.on.getCall(0).args[1]({ length: secondStep });

    expect(spy).to.have.callCount(3);
    expect(spy).to.have.been.calledWith({
      step: 0,
      maxStep: max,
      message: 'My prefix [0.0 MB of 4.0 MB]',
    });
    expect(spy).to.have.been.calledWith({
      step: firstStep,
      maxStep: max,
      message: 'My prefix [1.6 MB of 4.0 MB]',
    });
    expect(spy).to.have.been.calledWith({
      step: firstStep + secondStep,
      maxStep: max,
      message: 'My prefix [3.6 MB of 4.0 MB]',
    });
  });

  it('should report stream progress when total bytes unknown', () => {
    const spy = sandbox.spy();
    const mockReadable = {
      on: sandbox.spy()
    };
    (reportStreamProgress as any)(mockReadable, 'My prefix', undefined, spy);

    // There are no listeners registered to this readable
    expect(mockReadable.on).not.to.have.been.called;

    expect(spy).to.have.callCount(1);
    expect(spy).to.have.been.calledWith({
      step: 1,
      maxStep: 2,
      message: 'My prefix (Size unknown)',
    });
  });
});
