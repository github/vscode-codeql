import { expect } from 'chai';
import 'mocha';
import { EnvironmentVariableCollection, EnvironmentVariableMutator, Event, ExtensionContext, ExtensionMode, Memento, SecretStorage, SecretStorageChangeEvent, Uri, window } from 'vscode';
import * as yaml from 'js-yaml';
import * as tmp from 'tmp';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';

import {
  getInitialQueryContents,
  InvocationRateLimiter,
  isLikelyDbLanguageFolder,
  showBinaryChoiceDialog,
  showBinaryChoiceWithUrlDialog,
  showInformationMessageWithAction
} from '../../helpers';
import { reportStreamProgress } from '../../commandRunner';
import Sinon = require('sinon');
import { fail } from 'assert';

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
    extensionMode: ExtensionMode = 3;
    subscriptions: { dispose(): unknown }[] = [];
    workspaceState: Memento = new MockMemento();
    globalState = new MockGlobalStorage();
    extensionPath = '';
    asAbsolutePath(_relativePath: string): string {
      throw new Error('Method not implemented.');
    }
    storagePath = '';
    globalStoragePath = '';
    logPath = '';
    extensionUri = Uri.parse('');
    environmentVariableCollection = new MockEnvironmentVariableCollection();
    secrets = new MockSecretStorage();
    storageUri = Uri.parse('');
    globalStorageUri = Uri.parse('');
    logUri = Uri.parse('');
    extension: any;
  }

  class MockEnvironmentVariableCollection implements EnvironmentVariableCollection {
    persistent = false;
    replace(_variable: string, _value: string): void {
      throw new Error('Method not implemented.');
    }
    append(_variable: string, _value: string): void {
      throw new Error('Method not implemented.');
    }
    prepend(_variable: string, _value: string): void {
      throw new Error('Method not implemented.');
    }
    get(_variable: string): EnvironmentVariableMutator | undefined {
      throw new Error('Method not implemented.');
    }
    forEach(_callback: (variable: string, mutator: EnvironmentVariableMutator, collection: EnvironmentVariableCollection) => any, _thisArg?: any): void {
      throw new Error('Method not implemented.');
    }
    delete(_variable: string): void {
      throw new Error('Method not implemented.');
    }
    clear(): void {
      throw new Error('Method not implemented.');
    }
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

  class MockGlobalStorage extends MockMemento {
    public setKeysForSync(_keys: string[]): void {
      return;
    }
  }

  class MockSecretStorage implements SecretStorage {
    get(_key: string): Thenable<string | undefined> {
      throw new Error('Method not implemented.');
    }
    store(_key: string, _value: string): Thenable<void> {
      throw new Error('Method not implemented.');
    }
    delete(_key: string): Thenable<void> {
      throw new Error('Method not implemented.');
    }
    onDidChange!: Event<SecretStorageChangeEvent>;
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

  describe('open dialog', () => {
    let showInformationMessageSpy: Sinon.SinonStub;
    beforeEach(() => {
      showInformationMessageSpy = sandbox.stub(window, 'showInformationMessage');
    });

    it('should show a binary choice dialog and return `yes`', (done) => {
      // pretend user chooses 'yes'
      showInformationMessageSpy.onCall(0).resolvesArg(2);
      const res = showBinaryChoiceDialog('xxx');
      res.then((val) => {
        expect(val).to.eq(true);
        done();
      }).catch(e => fail(e));
    });

    it('should show a binary choice dialog and return `no`', (done) => {
      // pretend user chooses 'no'
      showInformationMessageSpy.onCall(0).resolvesArg(3);
      const res = showBinaryChoiceDialog('xxx');
      res.then((val) => {
        expect(val).to.eq(false);
        done();
      }).catch(e => fail(e));
    });

    it('should show an info dialog and confirm the action', (done) => {
      // pretend user chooses to run action
      showInformationMessageSpy.onCall(0).resolvesArg(1);
      const res = showInformationMessageWithAction('xxx', 'yyy');
      res.then((val) => {
        expect(val).to.eq(true);
        done();
      }).catch(e => fail(e));
    });

    it('should show an action dialog and avoid choosing the action', (done) => {
      // pretend user does not choose to run action
      showInformationMessageSpy.onCall(0).resolves(undefined);
      const res = showInformationMessageWithAction('xxx', 'yyy');
      res.then((val) => {
        expect(val).to.eq(false);
        done();
      }).catch(e => fail(e));
    });

    it('should show a binary choice dialog with a url and return `yes`', (done) => {
      // pretend user clicks on the url twice and then clicks 'yes'
      showInformationMessageSpy.onCall(0).resolvesArg(2);
      showInformationMessageSpy.onCall(1).resolvesArg(2);
      showInformationMessageSpy.onCall(2).resolvesArg(3);
      const res = showBinaryChoiceWithUrlDialog('xxx', 'invalid:url');
      res.then((val) => {
        expect(val).to.eq(true);
        done();
      }).catch(e => fail(e));
    });

    it('should show a binary choice dialog with a url and return `no`', (done) => {
      // pretend user clicks on the url twice and then clicks 'no'
      showInformationMessageSpy.onCall(0).resolvesArg(2);
      showInformationMessageSpy.onCall(1).resolvesArg(2);
      showInformationMessageSpy.onCall(2).resolvesArg(4);
      const res = showBinaryChoiceWithUrlDialog('xxx', 'invalid:url');
      res.then((val) => {
        expect(val).to.eq(false);
        done();
      }).catch(e => fail(e));
    });

    it('should show a binary choice dialog and exit after clcking `more info` 5 times', (done) => {
      // pretend user clicks on the url twice and then clicks 'no'
      showInformationMessageSpy.onCall(0).resolvesArg(2);
      showInformationMessageSpy.onCall(1).resolvesArg(2);
      showInformationMessageSpy.onCall(2).resolvesArg(2);
      showInformationMessageSpy.onCall(3).resolvesArg(2);
      showInformationMessageSpy.onCall(4).resolvesArg(2);
      const res = showBinaryChoiceWithUrlDialog('xxx', 'invalid:url');
      res.then((val) => {
        // No choie was made
        expect(val).to.eq(undefined);
        expect(showInformationMessageSpy.getCalls().length).to.eq(5);
        done();
      }).catch(e => fail(e));
    });
  });
});
