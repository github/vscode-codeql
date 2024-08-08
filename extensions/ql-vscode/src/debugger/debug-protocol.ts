import type { DebugProtocol } from "@vscode/debugprotocol";
import type { QueryResultType } from "../query-server/messages";
import type { QuickEvalContext } from "../run-queries-shared";

// Events

export type Event = { type: "event" };

export type StoppedEvent = DebugProtocol.StoppedEvent &
  Event & { event: "stopped" };

export type InitializedEvent = DebugProtocol.InitializedEvent &
  Event & { event: "initialized" };

export type ExitedEvent = DebugProtocol.ExitedEvent &
  Event & { event: "exited" };

export type OutputEvent = DebugProtocol.OutputEvent &
  Event & { event: "output" };

/**
 * Custom event to provide additional information about a running evaluation.
 */
export interface EvaluationStartedEvent extends Event {
  event: "codeql-evaluation-started";
  body: {
    id: string;
    outputDir: string;
    quickEvalContext: QuickEvalContext | undefined;
  };
}

/**
 * Custom event to provide additional information about a completed evaluation.
 */
export interface EvaluationCompletedEvent extends Event {
  event: "codeql-evaluation-completed";
  body: {
    resultType: QueryResultType;
    message: string | undefined;
    evaluationTime: number;
  };
}

export type AnyEvent =
  | StoppedEvent
  | ExitedEvent
  | InitializedEvent
  | OutputEvent
  | EvaluationStartedEvent
  | EvaluationCompletedEvent;

// Requests

export type Request = DebugProtocol.Request & { type: "request" };

export type InitializeRequest = DebugProtocol.InitializeRequest &
  Request & { command: "initialize" };

export interface LaunchConfig {
  /** Full path to query (.ql) file. */
  query: string;
  /** Full path to the database directory. */
  database: string;
  /** Full paths to `--additional-packs` directories. */
  additionalPacks: string[];
  /** Pack names of extension packs. */
  extensionPacks: string[];
  /** Optional quick evaluation context. */
  quickEvalContext: QuickEvalContext | undefined;
  /** Run the query without debugging it. */
  noDebug: boolean;
  /** Undocumented: Additional arguments to be passed to the `runQuery` API on the query server. */
  additionalRunQueryArgs: Record<string, unknown>;
}

export interface LaunchRequest extends Request, DebugProtocol.LaunchRequest {
  type: "request";
  command: "launch";
  arguments: DebugProtocol.LaunchRequestArguments & LaunchConfig;
}

export interface QuickEvalRequest extends Request {
  command: "codeql-quickeval";
  arguments: {
    quickEvalContext: QuickEvalContext;
  };
}

export type AnyRequest = InitializeRequest | LaunchRequest | QuickEvalRequest;

// Responses

export type Response = DebugProtocol.Response & { type: "response" };

export type InitializeResponse = DebugProtocol.InitializeResponse &
  Response & { command: "initialize" };

export type QuickEvalResponse = Response;

export type AnyResponse = InitializeResponse | QuickEvalResponse;

export type AnyProtocolMessage = AnyEvent | AnyRequest | AnyResponse;
