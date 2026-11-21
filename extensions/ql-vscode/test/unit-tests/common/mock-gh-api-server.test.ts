import { once } from "events";
import { readFile } from "fs/promises";
import { createServer } from "http";
import { join } from "path";
import { setTimeout } from "timers/promises";
import { withDir } from "tmp-promise";
import { MockGitHubApiServer } from "../../../src/common/mock-gh-api/mock-gh-api-server";

it("records a bypassed response and replays it in strict mode", async () => {
  const repository = { id: 123 };
  const upstream = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(repository));
  });
  const mockServer = new MockGitHubApiServer();

  try {
    const listening = once(upstream, "listening");
    upstream.listen(0, "127.0.0.1");
    await listening;
    const address = upstream.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected an IP address for the local upstream server");
    }
    const upstreamUrl = `http://127.0.0.1:${address.port}/repos/example/project`;

    await mockServer.startServer();
    await mockServer.startRecording();
    const response = await fetch(upstreamUrl);
    expect(await response.json()).toEqual(repository);

    // Recording reads the cloned body asynchronously after the fetch resolves.
    for (let i = 0; i < 100 && !mockServer.anyRequestsRecorded; i++) {
      await setTimeout(10);
    }
    expect(mockServer.anyRequestsRecorded).toBe(true);

    await withDir(
      async ({ path }) => {
        const savedScenario = await mockServer.saveScenario("recorded", path);
        const recording = await readFile(
          join(savedScenario, "0-getRepo.json"),
          "utf8",
        );
        expect(JSON.parse(recording)).toEqual({
          request: { kind: "getRepo" },
          response: { status: 200, body: repository },
        });

        mockServer.stopServer();
        await mockServer.startServer("error");
        await mockServer.loadScenario("recorded", path);
        const replay = await fetch(
          "https://api.github.com/repos/example/project",
        );
        expect(replay.status).toBe(200);
        expect(await replay.json()).toEqual(repository);

        const errorLog = jest
          .spyOn(console, "error")
          .mockImplementation(() => {});
        try {
          await expect(fetch(upstreamUrl)).rejects.toMatchObject({
            cause: {
              message: expect.stringContaining("Cannot bypass a request"),
            },
          });
        } finally {
          errorLog.mockRestore();
        }
      },
      { unsafeCleanup: true },
    );
  } finally {
    mockServer.stopServer();
    mockServer.dispose();
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
