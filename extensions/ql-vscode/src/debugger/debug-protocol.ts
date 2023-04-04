import { DebugProtocol } from "@vscode/debugprotocol";
import { QueryResultType } from "../pure/new-messages";

export type Event = { type: "event" };

export type StoppedEvent = DebugProtocol.StoppedEvent &
  Event & { event: "stopped" };

export type InitializedEvent = DebugProtocol.InitializedEvent &
  Event & { event: "initialized" };

export type OutputEvent = DebugProtocol.OutputEvent &
  Event & { event: "output" };

export interface EvaluationStartedEventBody {
  id: string;
  outputDir: string;
}

/**
 * Custom event to provide additional information about a running evaluation.
 */
export interface EvaluationStartedEvent extends DebugProtocol.Event {
  event: "codeql-evaluation-started";
  body: EvaluationStartedEventBody;
}

export interface EvaluationCompletedEventBody {
  resultType: QueryResultType;
  message: string | undefined;
  evaluationTime: number;
}

/**
 * Custom event to provide additional information about a completed evaluation.
 */
export interface EvaluationCompletedEvent extends DebugProtocol.Event {
  event: "codeql-evaluation-completed";
  body: EvaluationCompletedEventBody;
}

export type AnyEvent =
  | StoppedEvent
  | InitializedEvent
  | OutputEvent
  | EvaluationStartedEvent
  | EvaluationCompletedEvent;

export type Request = DebugProtocol.Request & { type: "request" };

export interface DebugResultRequest extends Request {
  command: "codeql-debug-result";
  arguments: undefined;
}

export type InitializeRequest = DebugProtocol.InitializeRequest &
  Request & { command: "initialize" };

export type AnyRequest = InitializeRequest | DebugResultRequest;

export type Response = DebugProtocol.Response & { type: "response" };

export type InitializeResponse = DebugProtocol.InitializeResponse &
  Response & { command: "initialize" };

export type AnyResponse = InitializeResponse;

export type AnyProtocolMessage = AnyEvent | AnyRequest | AnyResponse;

export interface Position {
  fileName: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface LaunchConfig {
  /** Full path to query (.ql) file. */
  query: string;
  /** Full path to the database directory. */
  database: string;
  /** Full paths to `--additional-packs` directories. */
  additionalPacks: string[];
  /** Pack names of extension packs. */
  extensionPacks: string[];
  /** Optional quick evaluation position. */
  quickEvalPosition: Position | undefined;
  /** Run the query without debugging it. */
  noDebug: boolean;
}

export type LaunchRequestArguments = DebugProtocol.LaunchRequestArguments &
  LaunchConfig;
