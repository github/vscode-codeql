import * as chai from 'chai';
import 'mocha';
import 'sinon-chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';
import TelemetryReporter from 'vscode-extension-telemetry';
import { Extension, ExtensionContext, workspace, ConfigurationTarget } from 'vscode';
import { initializeTelemetry, sendCommandUsage, _dispose } from '../../telemetry';
import { UserCancellationException } from '../../helpers';

chai.use(chaiAsPromised);
const expect = chai.expect;

const sandbox = sinon.createSandbox();

describe('telemetry reporting', () => {

  let originalTelemetryExtension: boolean | undefined;
  let originalTelemetryGlobal: boolean | undefined;
  let ctx: ExtensionContext;
  let ext: Extension<any>;

  beforeEach(async () => {
    ctx = createMockExtensionContext();
    ext = createMockExtension();
    sandbox.stub(TelemetryReporter.prototype, 'sendTelemetryEvent');
    sandbox.stub(TelemetryReporter.prototype, 'sendTelemetryException');
    sandbox.stub(TelemetryReporter.prototype, 'dispose');


    originalTelemetryExtension = workspace.getConfiguration('codeQL.telemetry').get<boolean>('enableTelemetry');
    originalTelemetryGlobal = workspace.getConfiguration('telemetry').get<boolean>('enableTelemetry');

    try {
      await enableTelemetry('telemetry', true);
      await enableTelemetry('codeQL.telemetry', true);
    } catch (e) {
      console.error(e);
    }
    // each test will default to telemetry being enabled
    _dispose();
  });

  afterEach(async () => {
    sandbox.restore();
    try {
      await enableTelemetry('telemetry', originalTelemetryGlobal);
      await enableTelemetry('codeQL.telemetry', originalTelemetryExtension);
    } catch (e) {
      console.error(e);
    }
    _dispose();
  });

  it('should initialize telemetry when both options are enabled', async () => {
    initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions[1]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(2);

    const reporter: any = ctx.subscriptions[1];
    expect(reporter.extensionId).to.eq('my-id');
    expect(reporter.extensionVersion).to.eq('1.2.3');
    expect(reporter.userOptIn).to.eq(true); // enabled
  });

  it('should initialize telemetry when global option disabled', async () => {
    await enableTelemetry('telemetry', false);
    initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions[1]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(2);

    const reporter: any = ctx.subscriptions[1];
    expect(reporter.userOptIn).to.eq(false); // disabled
  });

  it('should not initialize telemetry when extension option disabled', async () => {
    await enableTelemetry('codeQL.telemetry', false);
    initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions.length).to.eq(1);
  });

  it('should not initialize telemetry when both options disabled', async () => {
    await enableTelemetry('codeQL.telemetry', false);
    await enableTelemetry('telemetry', false);
    initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions.length).to.eq(1);
  });

  it('should dispose telemetry object when re-initializing and should not add multiple', () => {
    initializeTelemetry(ext, ctx);
    initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[0]).not.to.be.instanceOf(TelemetryReporter); // workspace config listener
    expect(ctx.subscriptions[1]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions[2]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(3);

    expect(TelemetryReporter.prototype.dispose).to.have.been.calledOnce;

    // initializing a third time continues to work
    initializeTelemetry(ext, ctx);

    expect(ctx.subscriptions[3]).to.be.instanceOf(TelemetryReporter);
    expect(ctx.subscriptions.length).to.eq(4);
    expect(TelemetryReporter.prototype.dispose).to.have.been.calledTwice;
  });

  it('should reinitialize reporter when extension setting changes', async () => {
    initializeTelemetry(ext, ctx);

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
    initializeTelemetry(ext, ctx);

    const reporter: any = ctx.subscriptions[1];
    expect(reporter.userOptIn).to.eq(true); // enabled

    await enableTelemetry('telemetry', false);
    expect(reporter.userOptIn).to.eq(false); // disabled
  });

  it('should send an event', () => {
    initializeTelemetry(ext, ctx);

    sendCommandUsage('command-id', 1234, undefined);

    expect(TelemetryReporter.prototype.sendTelemetryEvent).to.have.been.calledOnceWith('command-usage',
      {
        name: 'command-id',
        status: 'Success',
      },
      { executionTime: 1234 });

    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been.called;
  });

  it('should send a command usage event with a error', () => {
    initializeTelemetry(ext, ctx);
    const err = new Error('my-error');

    sendCommandUsage('command-id', 1234, err);

    expect(TelemetryReporter.prototype.sendTelemetryEvent).to.have.been.calledOnceWith('command-usage',
      {
        name: 'command-id',
        status: 'Failed',
      },
      { executionTime: 1234 });

    expect(TelemetryReporter.prototype.sendTelemetryException).to.have.been.calledOnceWith(err,
      {
        name: 'command-id',
        status: 'Failed',
        type: 'command-usage'
      },
      { executionTime: 1234 });
  });

  it('should send a command usage event with an error', () => {
    initializeTelemetry(ext, ctx);

    sendCommandUsage('command-id', 1234, new UserCancellationException());

    expect(TelemetryReporter.prototype.sendTelemetryEvent).to.have.been.calledOnceWith('command-usage',
      {
        name: 'command-id',
        status: 'Cancelled',
      },
      { executionTime: 1234 });

    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been.called;
  });

  it('should avoid sending an event when telemetry is disabled', async () => {
    initializeTelemetry(ext, ctx);
    await enableTelemetry('codeQL.telemetry', false);

    sendCommandUsage('command-id', 1234, undefined);
    sendCommandUsage('command-id', 1234, new Error());

    expect(TelemetryReporter.prototype.sendTelemetryEvent).not.to.have.been.called;
    expect(TelemetryReporter.prototype.sendTelemetryException).not.to.have.been.called;
  });

  it('should send an event when telemetry is re-enabled', async () => {
    initializeTelemetry(ext, ctx);
    await enableTelemetry('codeQL.telemetry', false);
    await enableTelemetry('codeQL.telemetry', true);

    sendCommandUsage('command-id', 1234, undefined);

    expect(TelemetryReporter.prototype.sendTelemetryEvent).to.have.been.calledOnceWith('command-usage',
      {
        name: 'command-id',
        status: 'Success',
      },
      { executionTime: 1234 });
  });

  function createMockExtensionContext(): ExtensionContext {
    return {
      subscriptions: [] as any[]
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
    await workspace.getConfiguration(section).update('enableTelemetry', value, ConfigurationTarget.Global);
  }
});
