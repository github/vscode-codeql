import type { CancelReason } from "@vitest/runner";
import { createBirpc } from "birpc";
import type { WorkerGlobalState } from "vitest";
import type { VsCodeRunnerRPC, VscodeRuntimeRPC } from "./types";
import { provideWorkerState, runBaseTests } from "vitest/workers";
import { ModuleCacheMap } from "vite-node/client";

export async function run(): Promise<void> {
  console.log("in VS code");

  const ws = new WebSocket(process.env.VITEST_VSCODE_WEBSOCKET_ADDRESS ?? "");

  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => {
      console.log("websocket opened");
      resolve();
    };

    ws.onerror = (error) => {
      console.error("websocket error", error);
      reject(error);
    };

    ws.onclose = (event) => {
      console.log("websocket closed", event);
      reject(new Error("WebSocket connection closed"));
    };
  });

  console.log("connected to websocket");

  let setCancel = (_reason: CancelReason) => {};
  const onCancel = new Promise<CancelReason>((resolve) => {
    setCancel = resolve;
  });

  const rpc = createBirpc<VscodeRuntimeRPC, VsCodeRunnerRPC>(
    {
      onCancel: setCancel,
      runTests: async (specs, invalidates, config) => {
        const state: WorkerGlobalState = {
          ctx: {
            pool: "vscode",
            worker: __filename,
            workerId: 1,
            environment: {
              name: "vscode",
              options: null,
            },
            config,
            files: specs,
            invalidates,
            projectName: config.name ?? "",
            providedContext: {},
          },
          environment: {
            name: "vscode",
            transformMode: "web",
            setup() {
              return {
                teardown: () => {},
              };
            },
          },
          onCancel,
          config,
          moduleCache: new ModuleCacheMap(),
          moduleExecutionInfo: new Map(),
          providedContext: {},
          durations: {
            environment: 0,
            prepare: 0,
          },
          onCleanup: () => {},

          rpc,
        };

        // provideWorkerState(globalThis, state);

        // const vitestRunners = await import("vitest/runners");
        //
        // const runner = new vitestRunners.VitestTestRunner(config);

        // void onCancel.then((reason) => {
        //   runner.cancel?.(reason);
        // });

        await runBaseTests("run", state);
      },
    },
    {
      eventNames: ["onUserConsoleLog", "onCollected", "onCancel"],
      post: (data) => ws.send(data),
      on: (data) => {
        ws.onmessage = (event) => {
          data(event.data);
        };
      },
      serialize: (value) => JSON.stringify(value),
      deserialize: (value) => JSON.parse(value),
      onGeneralError(error, functionName, args) {
        console.error(error, functionName, args);
      },
      onFunctionError(error, functionName, args) {
        console.error(error, functionName, args);
      },
      onTimeoutError(functionName, args) {
        let message = `[vitest-worker]: Timeout calling "${functionName}"`;

        if (
          functionName === "fetch" ||
          functionName === "transform" ||
          functionName === "resolveId"
        ) {
          message += ` with "${JSON.stringify(args)}"`;
        }

        // JSON.stringify cannot serialize Error instances
        if (functionName === "onUnhandledError") {
          message += ` with "${args[0]?.message || args[0]}"`;
        }

        throw new Error(message);
      },
    },
  );

  console.log("created rpc");

  await rpc.onReady();
}
