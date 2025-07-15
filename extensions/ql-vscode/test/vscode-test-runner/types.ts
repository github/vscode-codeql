import type { RunnerRPC, RuntimeRPC, SerializedConfig } from "vitest";
import type { File } from "@vitest/runner";

export type VscodeRuntimeRPC = RuntimeRPC & {
  onReady: () => void;
};

export type VsCodeRunnerRPC = RunnerRPC & {
  runTests: (
    specs: string[],
    invalidates: string[],
    config: SerializedConfig,
  ) => Promise<void>;
};
