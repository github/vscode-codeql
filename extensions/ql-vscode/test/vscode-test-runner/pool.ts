import type {
  ProcessPool,
  TestProject,
  TestSpecification,
  Vitest,
} from "vitest/node";
import { createMethodsRPC } from "vitest/node";
import { dirname, resolve } from "path";
import { createHash } from "crypto";
import { downloadAndUnzipVSCode } from "@vscode/test-electron";
import { build, createLogger } from "vite";
import { spawn } from "node:child_process";
import { WebSocket, WebSocketServer } from "ws";
import { createBirpc } from "birpc";
import type { VsCodeRunnerRPC, VscodeRuntimeRPC } from "./types";
import { createServer } from "node:http";

interface VsCodeTestOptions {
  extensionDevelopmentPath?: string;
  launchArgs?: string[];
  workspaceDir?: string;
}

async function buildWorker(rootDir: string): Promise<string> {
  const testsDir = resolve(rootDir, ".vscode-test");
  const workerOutDir = resolve(testsDir, "pool", "dist");

  await build({
    root: __dirname,
    mode: "development",
    build: {
      outDir: workerOutDir,
      emptyOutDir: true,
      assetsDir: "",
      target: "node22",
      lib: {
        entry: resolve(__dirname, "worker.ts"),
        formats: ["cjs"],
        name: "worker",
        fileName: "worker",
      },
      minify: false,
    },
    customLogger: createLogger("warn"),
  });

  return resolve(workerOutDir, "worker.js");
}

async function runFiles(
  vitest: Vitest,
  vscodePath: string,
  name: string,
  project: TestProject,
  directory: string,
  specs: TestSpecification[],
  invalidates: string[] = [],
) {
  const rootDir = vitest.config.root;

  const paths = specs.map((f) => f.moduleId);
  vitest.state.clearFiles(project, paths);

  const vscodeTestOptions: VsCodeTestOptions =
    project.serializedConfig.environmentOptions?.vscodeTest ?? {};

  const workerPath = await buildWorker(rootDir);

  const args = [
    "-n",
    "--no-sandbox",
    "--disable-workspace-trust",
    `--extensionDevelopmentPath=${vscodeTestOptions.extensionDevelopmentPath ?? rootDir}`,
    `--extensionTestsPath=${workerPath}`,
    ...(vscodeTestOptions.workspaceDir ? [vscodeTestOptions.workspaceDir] : []),
    ...(vscodeTestOptions.launchArgs ?? []),
  ];

  const server = createServer((_req, res) => {
    res.writeHead(404, {
      "Content-Type": "text/plain",
    });
    res.end("Not Found");
  });
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(undefined);
    });
  });

  const wss = new WebSocketServer({
    server,
  });

  let resolveConnection: (ws: WebSocket) => void;
  const connectionPromise = new Promise<WebSocket>((resolve) => {
    resolveConnection = resolve;
  });

  wss.on("connection", (ws) => {
    resolveConnection(ws);
  });

  const address = wss.address();
  if (typeof address === "string" || address === null) {
    throw new Error(`WebSocket server address is not valid: ${address}`);
  }

  const vscode = spawn(vscodePath, args, {
    env: {
      ...process.env,
      VITEST_VSCODE_WEBSOCKET_ADDRESS: `ws://${address.address}:${address.port}`,
    },
  });

  vscode.stdout.pipe(process.stdout);
  vscode.stderr.pipe(process.stderr);

  const vscodeExitPromise = new Promise((resolve, reject) => {
    vscode.on("error", (error) => {
      reject(error);
    });

    vscode.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`VS Code exited with code ${code}`));
      } else {
        resolve(undefined);
      }
    });

    vscode.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`VS Code closed with code ${code}`));
      } else {
        resolve(undefined);
      }
    });
  });

  console.log("starting to wait");

  const websocket = await Promise.race([connectionPromise, vscodeExitPromise]);
  if (!(websocket instanceof WebSocket)) {
    throw new Error("Failed to connect to VS Code WebSocket");
  }

  let resolveReady: () => void;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const rpc = createBirpc<VsCodeRunnerRPC, VscodeRuntimeRPC>(
    {
      ...createMethodsRPC(project),
      onReady: () => {
        resolveReady();
      },
    },
    {
      eventNames: ["onCancel"],
      post: (msg) => websocket.send(msg),
      on: (fn) => websocket.on("message", fn),
      serialize: (value) => JSON.stringify(value),
      deserialize: (value) => JSON.parse(value),
    },
  );

  project.vitest.onCancel(async (reason) => {
    await rpc.onCancel(reason);
  });

  await readyPromise;

  console.log("calling runTests");

  await rpc.runTests(paths, invalidates, project.serializedConfig);
}

interface PoolProcessOptions {
  execArgv: string[];
  env: Record<string, string>;
}

export async function createVsCodeTestPool(
  vitest: Vitest,
  { execArgv, env }: PoolProcessOptions,
): Promise<ProcessPool> {
  const vscodePath = await downloadAndUnzipVSCode("stable", undefined);
  console.log(vscodePath);
  console.log(execArgv, env);

  const runWithFiles = (name: string) => {
    return async (specs: TestSpecification[], invalidates?: string[]) => {
      // TODO: Cancel pending tasks from pool when possible
      // vitest.onCancel(() => pool.cancelPendingTasks());

      const specsByProjectAndDirectory: Record<
        string,
        {
          project: TestProject;
          directory: string;
          specs: TestSpecification[];
        }
      > = {};
      for (const spec of specs) {
        const directoryName = dirname(spec.moduleId);

        const directoryNameHash = createHash("sha256");
        directoryNameHash.update(directoryName);

        const key = `${spec.project.hash}-${directoryNameHash.digest("hex")}`;

        if (!(key in specsByProjectAndDirectory)) {
          specsByProjectAndDirectory[key] = {
            project: spec.project,
            directory: directoryName,
            specs: [],
          };
        }
        specsByProjectAndDirectory[key].specs.push(spec);
      }

      const promises = Object.values(specsByProjectAndDirectory);
      const results = await Promise.allSettled(
        promises.map(({ project, directory, specs }) =>
          runFiles(
            vitest,
            vscodePath,
            name,
            project,
            directory,
            specs,
            invalidates,
          ),
        ),
      );

      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => r.reason);
      if (errors.length > 0) {
        throw new AggregateError(
          errors,
          "Errors occurred while running tests. For more information, see serialized error.",
        );
      }
    };
  };

  return {
    name: "vmThreads",
    runTests: runWithFiles("run"),
    collectTests: runWithFiles("collect"),
    // TODO: Implement the close method to clean up resources
    // close: () => pool.destroy(),
  };
}

export default createVsCodeTestPool;
