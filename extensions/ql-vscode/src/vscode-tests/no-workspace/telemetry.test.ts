import * as chai from 'chai';
import 'mocha';
import 'sinon-chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';
import TelemetryReporter from 'vscode-extension-telemetry';
import { Extension, ExtensionContext, workspace, ConfigurationTarget, window } from 'vscode';
import { initializeTelemetry, sendCommandUsage, _dispose } from '../../telemetry';
import { UserCancellationException } from '../../commandRunner';
import { fail } from 'assert';
import { ENABLE_TELEMETRY } from '../../config';

chai.use(chaiAsPromised);
const expect = chai.expect;

const sandbox = sinon.createSandbox();

describe('telemetry reporting', function() {
  // setting preferences can trigger lots of background activity
  // so need to bump up the timeout of this test.
  this.timeout(10000);

  let originalTelemetryExtension: boolean | undefined;
  let originalTelemetryGlobal: boolean | undefined;
  let isCanary: string;
  let ctx: ExtensionContext;
  let ext: Extension<any>;

  beforeEach(async () => {
    try {
      ctx = createMockExtensionContext();
      ext = createMockExtension();

      _dispose();
      sandbox.stub(TelemetryReporter.prototype, 'sendTelemetryEvent');
      sandbox.stub(TelemetryReporter.prototype, 'sendTelemetryException');
      sandbox.stub(TelemetryReporter.prototype, 'dispose');

      originalTelemetryExtension = workspace.getConfiguration().get<boolean>('codeQL.telemetry.enableTelemetry');
      originalTelemetryGlobal = workspace.getConfiguration().get<boolean>('telemetry.enableTelemetry');
      isCanary = (!!workspace.getConfiguration().get<boolean>('codeQL.canary')).toString();

      // each test will default to telemetry being enabled
      await enableTelemetry('telemetry', true);
      await enableTelemetry('codeQL.telemetry', true);
    } catch (e) {
      console.error(e);
    }
  });

  afterEach(async () => {
    try {
      sandbox.restore();
      await enableTelemetry('telemetry', originalTelemetryGlobal);
      await enableTelemetry('codeQL.telemetry', originalTelemetryExtension);
    } catch (e) {
      console.error(e);
    }
    _dispose();
  });

  it('should initialize telemetry when both options are enabled', async () => {
    await initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions[1]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(2);

    const reporter: any = ctx.subscriptions[1];
    expect(reporter.extensionId).to.eq('my-id');
    expect(reporter.extensionVersion).to.eq('1.2.3');
    expect(reporter.userOptIn).to.eq(true); // enabled
  });

  it('should initialize telemetry when global option disabled', async () => {
    try {
      await enableTelemetry('telemetry', false);
      await initializeTelemetry(ext, ctx);

      expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
      expect(ctx.subscriptions[1]).to.be.instanceOf(TelemetryReporter);
      expect(ctx.subscriptions.length).to.eq(2);

      const reporter: any = ctx.subscriptions[1];
      expect(reporter.userOptIn).to.eq(false); // disabled
    } catch (e) {
      fail(e);
    }
  });

  it('should not initialize telemetry when extension option disabled', async () => {
    try {
      await enableTelemetry('codeQL.telemetry', false);
      await initializeTelemetry(ext, ctx);

      expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
      expect(ctx.subscriptions.length).to.eq(1);
    } catch (e) {
      fail(e);
    }
  });

  it('should not initialize telemetry when both options disabled', async () => {
    await enableTelemetry('codeQL.telemetry', false);
    await enableTelemetry('telemetry', false);
    await initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions.length).to.eq(1);
  });

  it('should dispose telemetry object when re-initializing and should not add multiple', async () => {
    await initializeTelemetry(ext, ctx);
    await initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions[1]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions[2]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(3);

    expect(TelemetryReporter.prototype.dispose).to.have.been.calledOnce;

    // initializing a third time continues to work
    await initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[3]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(4);
    expect(TelemetryReporter.prototype.dispose).to.have.been.calledTwice;
  });

  it('should reinitialize reporter when extension setting changes', async () => {
    await initializeTelemetry(ext, ctx);

    expect(TelemetryReporter.prototype.dispose).not.to.have.been.called;

    // this disables the reporter
    await enableTelemetry('codeQL.telemetry', false);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions[1]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(2);
    expect(TelemetryReporter.prototype.dispose).to.have.been.calledOnce;

    // creates a new reporter
    await enableTelemetry('codeQL.telemetry', true);

    expect(ctx.subscriptions[2]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(3);
  });


  it('should set userOprIn to false when global setting changes', async () => {
    await initializeTelemetry(ext, ctx);

    const reporter: any = ctx.subscriptions[1];
    expect(reporter.userOptIn).to.eq(true); // enabled

    await enableTelemetry('telemetry', false);
    expect(reporter.userOptIn).to.eq(false); // disabled
  });

  it('should send an event', async () => {
    await initializeTelemetry(ext, ctx);

    sendCommandUsage('command-id', 1234, undefined);

    expect(TelemetryReporter.prototype.sendTelemetryEvent).to.have.been.calledOnceWith('command-usage',
      {
        name: 'command-id',
        status: 'Success',
        isCanary
      },
      { executionTime: 1234 });

    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been.called;
  });

  it('should send a command usage event with a error', async () => {
    await initializeTelemetry(ext, ctx);
    const err = new Error('my-error');

    sendCommandUsage('command-id', 1234, err);

    expect(TelemetryReporter.prototype.sendTelemetryEvent).to.have.been.calledOnceWith('command-usage',
      {
        name: 'command-id',
        status: 'Failed',
        isCanary
      },
      { executionTime: 1234 });

    expect(TelemetryReporter.prototype.sendTelemetryException).to.have.been.calledOnceWith({
      name: err.name,
      message: '<MESSAGE REDACTED>',
      stack: err.stack
    },
      {
        name: 'command-id',
        status: 'Failed',
        type: 'command-usage',
        isCanary
      },
      { executionTime: 1234 });
  });

  it('should send a command usage event with an error', async () => {
    await initializeTelemetry(ext, ctx);

    sendCommandUsage('command-id', 1234, new UserCancellationException());

    expect(TelemetryReporter.prototype.sendTelemetryEvent).to.have.been.calledOnceWith('command-usage',
      {
        name: 'command-id',
        status: 'Cancelled',
        isCanary
      },
      { executionTime: 1234 });

    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been.called;
  });

  it('should avoid sending an event when telemetry is disabled', async () => {
    await initializeTelemetry(ext, ctx);
    await enableTelemetry('codeQL.telemetry', false);

    sendCommandUsage('command-id', 1234, undefined);
    sendCommandUsage('command-id', 1234, new Error());

    expect(TelemetryReporter.prototype.sendTelemetryEvent).not.to.have.been.called;
    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been.called;
  });

  it('should send an event when telemetry is re-enabled', async () => {
    await initializeTelemetry(ext, ctx);
    await enableTelemetry('codeQL.telemetry', false);
    await enableTelemetry('codeQL.telemetry', true);

    sendCommandUsage('command-id', 1234, undefined);

    expect(TelemetryReporter.prototype.sendTelemetryEvent).to.have.been.calledOnceWith('command-usage',
      {
        name: 'command-id',
        status: 'Success',
        isCanary
      },
      { executionTime: 1234 });
  });

  it('should filter undesired properties from telemetry payload', async () => {
    await initializeTelemetry(ext, ctx);
    // Reach into the internal appInsights client to grab our telemetry processor.
    const telemetryProcessor: Function =
      ((ctx.subscriptions[1] as any).appInsightsClient._telemetryProcessors)[0];
    const envelop = {
      tags: {
        'ai.cloud.roleInstance': true,
        other: true
      },
      data: {
        baseData: {
          properties: {
            'common.remotename': true,
            other: true
          }
        }
      }
    };
    const res = telemetryProcessor(envelop);
    expect(res).to.eq(true);
    expect(envelop).to.deep.eq({
      tags: {
        other: true
      },
      data: {
        baseData: {
          properties: {
            other: true
          }
        }
      }
    });
  });

  it('should request permission if popup has never been seen before', async () => {
    sandbox.stub(window, 'showInformationMessage').resolvesArg(2 /* "yes" item */);
    await ctx.globalState.update('telemetry-request-viewed', false);
    await enableTelemetry('codeQL.telemetry', false);

    await initializeTelemetry(ext, ctx);

    // Dialog opened, user clicks "yes" and telemetry enabled
    expect(window.showInformationMessage).to.have.been.calledOnce;
    expect(ENABLE_TELEMETRY.getValue()).to.eq(true);
    expect(ctx.globalState.get('telemetry-request-viewed')).to.be.true;
  });

  it('should prevent telemetry if permission is denied', async () => {
    sandbox.stub(window, 'showInformationMessage').resolvesArg(3 /* "no" item */);
    await ctx.globalState.update('telemetry-request-viewed', false);
    await enableTelemetry('codeQL.telemetry', true);

    await initializeTelemetry(ext, ctx);

    // Dialog opened, user clicks "no" and telemetry disabled
    expect(window.showInformationMessage).to.have.been.calledOnce;
    expect(ENABLE_TELEMETRY.getValue()).to.eq(false);
    expect(ctx.globalState.get('telemetry-request-viewed')).to.be.true;
  });

  it('should unchange telemetry if permission dialog is cancelled', async () => {
    sandbox.stub(window, 'showInformationMessage').resolves(undefined /* cancelled */);
    await ctx.globalState.update('telemetry-request-viewed', false);
    await enableTelemetry('codeQL.telemetry', false);

    await initializeTelemetry(ext, ctx);

    // Dialog opened, user clicks "no" and telemetry disabled
    expect(window.showInformationMessage).to.have.been.calledOnce;
    expect(ENABLE_TELEMETRY.getValue()).to.eq(false);
    // dialog was canceled, so should not have marked as viewed
    expect(ctx.globalState.get('telemetry-request-viewed')).to.be.false;
  });

  it('should unchange telemetry if permission dialog is cancelled if starting as true', async () => {
    // as before, except start with telemetry enabled. It should _stay_ enabled if the
    // dialog is canceled.
    sandbox.stub(window, 'showInformationMessage').resolves(undefined /* cancelled */);
    await ctx.globalState.update('telemetry-request-viewed', false);
    await enableTelemetry('codeQL.telemetry', true);

    await initializeTelemetry(ext, ctx);

    // Dialog opened, user clicks "no" and telemetry disabled
    expect(window.showInformationMessage).to.have.been.calledOnce;
    expect(ENABLE_TELEMETRY.getValue()).to.eq(true);
    // dialog was canceled, so should not have marked as viewed
    expect(ctx.globalState.get('telemetry-request-viewed')).to.be.false;
  });

  it('should avoid showing dialog if global telemetry is disabled', async () => {
    // when telemetry is disabled globally, we never want to show the
    // opt in/out dialog. We just assume that codeql telemetry should
    // remain disabled as well.
    // If the user ever turns global telemetry back on, then we can
    // show the dialog.

    await enableTelemetry('telemetry', false);
    await ctx.globalState.update('telemetry-request-viewed', false);
    sandbox.stub(window, 'showInformationMessage');

    await initializeTelemetry(ext, ctx);

    // popup should not be shown even though we have initialized telemetry
    expect(window.showInformationMessage).not.to.have.been.called;
  });

  // This test is failing because codeQL.canary is not a registered configuration.
  // We do not want to have it registered because we don't want this item
  // appearing in the settings page. It needs to olny be set by users we tell
  // about it to.
  // At this point, I see no other way of testing re-requesting permission.
  xit('should request permission again when user changes canary setting', async () => {
    // initially, both canary and telemetry are false
    await workspace.getConfiguration().update('codeQL.canary', false);
    await enableTelemetry('codeQL.telemetry', false);
    await ctx.globalState.update('telemetry-request-viewed', true);
    await initializeTelemetry(ext, ctx);
    sandbox.stub(window, 'showInformationMessage').resolves(undefined /* cancelled */);

    // set canary to true
    await workspace.getConfiguration().update('codeQL.canary', true);

    // now, we should have to click through the telemetry requestor again
    expect(ctx.globalState.get('telemetry-request-viewed')).to.be.false;
    expect(window.showInformationMessage).to.have.been.calledOnce;
  });

  function createMockExtensionContext(): ExtensionContext {
    return {
      subscriptions: [] as any[],
      globalState: {
        _state: {
          'telemetry-request-viewed': true
        } as Record<string, any>,
        get(key: string) {
          return this._state[key];
        },
        update(key: string, val: any) {
          this._state[key] = val;
        }
      }
    } as any;
  }

  function createMockExtension(): Extension<any> {
    return {
      id: 'my-id',
      packageJSON: {
        version: '1.2.3'
      }
    } as any;
  }

  async function enableTelemetry(section: string, value: boolean | undefined) {
    await workspace.getConfiguration(section).update(
      'enableTelemetry', value, ConfigurationTarget.Global
    );

    // Need to wait some time since the onDidChangeConfiguration listeners fire
    // asynchronously and we sometimes need to wait for them to complete in
    // order to have as successful test.
    await wait(5);
  }

  async function wait(ms = 0) {
    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  }
});
