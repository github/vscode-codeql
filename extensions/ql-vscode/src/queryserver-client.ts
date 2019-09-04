import * as cp from 'child_process';
import * as jspb from 'google-protobuf';
import { encodeUInt32 } from 'leb';
import * as path from 'path';
import * as compilation from '../gen/compilation_server_protocol_pb';
import * as core from '../gen/core_messages_protocol_pb';
import * as evaluation from '../gen/evaluation_server_protocol_pb';
import { StreamDigester } from 'semmle-io';
import { QLConfigurationData } from './configData';

/**
 * queryserver-client.ts
 * ------------
 *
 * Managing the query server for QL evaluation.
 *
 * We speak the protocol described in
 * [[https://git.semmle.com/Semmle/code/queryserver-client/src/com/semmle/queryserver/client/rpc/AbstractProtoBufClient.java]],
 * which is mostly exchanging protobuf messages, but with a little bit
 * of custom RPC wrapper to tell what service we're asking for.
 * The reason why protobuf services weren't used is
 * [[https://github.com/protocolbuffers/protobuf/issues/2917]]
 */

/**
 * A position in a file.
 */
export type Position = {
  file: string,
  startLine: number, // 1-based
  startColumn: number, // 1-based
  endLine: number,
  endColumn: number,
};

/**
 * Based on
 * [[https://git.semmle.com/Semmle/code/blob/master/queryserver-client/src/com/semmle/queryserver/client/QueryServerServices.java]]
 * [[https://git.semmle.com/Semmle/code/blob/master/queryserver-client/src/com/semmle/queryserver/client/rpc/CoreServices.java]]
 */
enum ServiceCode {
  COMPILE_QUERY = 1,
  CHECK_QUERY,
  EVALUATE_QUERY,
  COMPILE_UPGRADE,
  RUN_UPGRADE,
  CHECK_UPGRADE,
  CANCEL,
  CLEAR_CACHE,
  COMPILE_DIL_QUERY,
}

enum ResultCode {
  RESULT = 0,
  DONE,
  PROGRESS,
  UNEXPECTED_ERROR,
}

enum EvaluationResultType {
  SUCCESS = 0,
  OTHER_ERROR,
  OOM,
  TIMEOUT,
  CANCELLATION,
}

type ProgressMessage = core.ProgressUpdate.AsObject;
type UnexpectedError = core.UnexpectedError.AsObject;
type CheckQueryResult = compilation.CheckQueryResult.AsObject;
type ClearCacheResult = evaluation.ClearCacheResult.AsObject;
type EvaluationResult = evaluation.Result.AsObject;

type RespParser = (s: Server) => Promise<Msg>;

type Msg =
  | { t: 'done' }
  | { t: 'progress', proto: ProgressMessage }
  | { t: 'unexpectedError', proto: UnexpectedError }
  | { t: 'result', buffer: Buffer };

const responseParser: { [x: number]: RespParser } = {
  [ResultCode.RESULT]: parseResult,
  [ResultCode.DONE]: parseDone,
  [ResultCode.PROGRESS]: parseProgress,
  [ResultCode.UNEXPECTED_ERROR]: parseUnexpectedError,
}

async function parseDone(s: Server): Promise<Msg> {
  return { t: 'done' };
}

async function parseResult(s: Server): Promise<Msg> {
  const d = s.digester;
  const len = await d.readLEB128UInt32();
  return { t: 'result', buffer: await d.read(len) };
}

async function parseProgress(s: Server): Promise<Msg> {
  const d = s.digester;
  const len = await d.readLEB128UInt32();
  return { t: 'progress', proto: core.ProgressUpdate.deserializeBinary(await d.read(len)).toObject() };
}

async function parseUnexpectedError(s: Server): Promise<Msg> {
  const d = s.digester;
  const len = await d.readLEB128UInt32();
  return { t: 'unexpectedError', proto: core.UnexpectedError.deserializeBinary(await d.read(len)).toObject() };
}

type ProtocolResponse = { id: number, payload: Msg };

type ServerOpts = {
  logger: (s: string) => void
}

type RequestHandlers<T> = {
  onResult: (x: T) => void,
  onProgress: (x: ProgressMessage) => void,
  onDone: () => void,
};

type Request<T> = {
  service: ServiceCode,
  handlers: RequestHandlers<T>,
};

export class Server {
  private child: cp.ChildProcess;
  private nextId: number = 100;
  private requests: { [id: number]: Request<any> } = {}; // if only we had dependent types...
  digester: StreamDigester;
  opts: ServerOpts;

  constructor(config: QLConfigurationData, opts: ServerOpts) {
    this.opts = opts;

    const command = config.javaCommand;
    const jvmargs = ["-cp", path.resolve(config.qlDistributionPath, 'tools/odasa.jar'), 'com.semmle.api.server.CombinedServer'];
    const otherArgs = [];
    const args = jvmargs.concat(otherArgs);
    const child = cp.spawn(command, args);
    if (!child || !child.pid) {
      throw new Error(`Launching query server ${command} ${args} failed.`);
    }
    child.stderr.on('data', data => {
      this.log(`stderr: ${data}`);
    });
    child.on('close', (code) => {
      this.log(`child process exited with code ${code}`);
    });
    this.child = child;
    this.digester = StreamDigester.fromChunkIterator(child.stdout);

    this.asyncStart().catch((e: Error) => {
      this.log('Query server error: ' + e.toString() + '\n' + e.stack);
      throw e;
    });
  }

  async asyncStart() {
    await this.listener();
  }

  getReqForResp(resp: ProtocolResponse): Request<any> {
    if (!(resp.id in this.requests)) {
      throw new Error(`Received response for id ${resp.id} but never made that request`);
    }
    return this.requests[resp.id];
  }

  async listener() {
    while (1) {
      const resp = await this.parseResponse();
      const payload = resp.payload;
      const req = this.getReqForResp(resp);
      switch (payload.t) {
        case "progress":
          (req.handlers.onProgress)(payload.proto);
          break;
        case "done":
          (req.handlers.onDone)();
          delete this.requests[resp.id];
          break;
        case "result": {
          const buf = payload.buffer;
          const handler = req.handlers.onResult;
          if (req.service == ServiceCode.COMPILE_QUERY) {
            handler(compilation.CheckQueryResult.deserializeBinary(buf).toObject());
          }
          else if (req.service == ServiceCode.EVALUATE_QUERY) {
            handler(evaluation.Result.deserializeBinary(buf).toObject());
          }
          else if (req.service === ServiceCode.CLEAR_CACHE) {
            handler(evaluation.ClearCacheResult.deserializeBinary(buf).toObject());
          }
          else {
            if (ServiceCode[req.service] == undefined) {
              throw new Error(`service code ${req.service} unknown`);
            }
            throw new Error(`service ${ServiceCode[req.service]} unimplemented`);
          }
        }
          break;
        case "unexpectedError":
          this.log(JSON.stringify(resp, null, 2));
          break;
      }
    }
  }

  getPid(): number {
    return this.child.pid;
  }

  log(s: string) {
    if (this.opts && this.opts.logger) {
      (this.opts.logger)(s);
    }
  }

  makeRequest<T>(payload: jspb.Message, req: Request<T>): void {
    const id = this.nextId++;
    const { child } = this;

    const buffer = Buffer.from(payload.serializeBinary());
    this.requests[id] = req;

    child.stdin!.write(encodeUInt32(req.service)); // service
    child.stdin!.write(encodeUInt32(id)); // request id
    child.stdin!.write(encodeUInt32(buffer.length)); // protobuf length
    child.stdin!.write(buffer); // protobuf
  }

  clearCache(
    database: evaluation.Database,
    handlers: RequestHandlers<ClearCacheResult>
  ) {
    const msg = new evaluation.ClearCacheInput();
    msg.setDb(database);
    this.makeRequest<ClearCacheResult>(msg, { service: ServiceCode.CLEAR_CACHE, handlers });
  }

  runQuery(queryToRun: evaluation.QueryToRun, database: evaluation.Database, handlers: RequestHandlers<EvaluationResult>) {
    const msg = new evaluation.MultipleQueriesInput();
    msg.setQueriesList([queryToRun]);
    msg.setDatabase(database);
    msg.setStopOnError(true);
    msg.setUseSequenceHint(false);
    this.makeRequest<EvaluationResult>(msg, { service: ServiceCode.EVALUATE_QUERY, handlers });
  }

  compileQuery(
    queryToCheck: compilation.QlProgram,
    outPath: string,
    handlers: RequestHandlers<CheckQueryResult>,
    quickEvalPosition?: Position,
  ) {
    const msg = new compilation.CompileQueryInput();
    msg.setResultPath(outPath);

    const opts = new compilation.OtherCompilationOptions();
    opts.setTimeoutSecs(1000); // XXX hardcoded timeout
    msg.setExtraOptions(opts);
    const compReq = new compilation.QlCompilationRequest();
    compReq.setQueryToCheck(queryToCheck);
    const target = new compilation.CompilationTarget();
    if (quickEvalPosition == undefined) {
      target.setQuery();
    }
    else {
      const posProto = new compilation.Position();
      posProto.setFileName(quickEvalPosition.file);
      posProto.setLine(quickEvalPosition.startLine);
      posProto.setColumn(quickEvalPosition.startColumn);
      posProto.setEndLine(quickEvalPosition.endLine);
      posProto.setEndColumn(quickEvalPosition.endColumn);
      const quickEvalTarget = new compilation.QuickEvalTarget();
      quickEvalTarget.setQuickEvalPos(posProto);
      target.setQuickEval(quickEvalTarget);
    }
    compReq.setTarget(target);
    msg.setQueryInput(compReq);

    this.makeRequest<CheckQueryResult>(msg, { service: ServiceCode.COMPILE_QUERY, handlers });
  }

  async parseResponse(): Promise<ProtocolResponse> {
    const d = this.digester;
    const id = await d.readLEB128UInt32();
    const respType = await d.readByte();
    const parser = responseParser[respType];
    if (parser == undefined) {
      throw new Error(`query server protocol parsing failure, got unknown protocol result code ${id}`);
    }
    else {
      return { id, payload: await parser(this) };
    }
  }
}
