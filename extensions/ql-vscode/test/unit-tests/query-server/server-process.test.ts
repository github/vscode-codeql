import { EventEmitter } from "events";
import { ServerProcess } from "../../../src/query-server/server-process";

function createFakeChild(): any {
  const child = new EventEmitter() as any;
  child.exitCode = null;
  child.signalCode = null;
  child.kill = jest.fn((signal?: string) => {
    child.exitCode = 1;
    child.emit("exit", null, signal ?? "SIGKILL");
    return true;
  });
  return child;
}

const fakeConnection = { dispose: jest.fn(), end: jest.fn() } as any;
const fakeLogger = { log: jest.fn() } as any;

function createServerProcess(child: any): ServerProcess {
  return new ServerProcess(
    child,
    fakeConnection,
    "test query server",
    fakeLogger,
  );
}

describe("ServerProcess.waitForExit", () => {
  it("resolves when the process exits", async () => {
    const child = createFakeChild();
    const serverProcess = createServerProcess(child);

    const promise = serverProcess.waitForExit();
    child.exitCode = 0;
    child.emit("exit", 0, null);

    await expect(promise).resolves.toBeUndefined();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("resolves immediately if the process has already exited", async () => {
    const child = createFakeChild();
    child.exitCode = 0;
    const serverProcess = createServerProcess(child);

    await expect(serverProcess.waitForExit()).resolves.toBeUndefined();
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("force-kills the process if it does not exit within the timeout", async () => {
    jest.useFakeTimers();
    try {
      const child = createFakeChild();
      const serverProcess = createServerProcess(child);

      const promise = serverProcess.waitForExit(1000);
      jest.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();
      expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    } finally {
      jest.useRealTimers();
    }
  });
});
