import type { EvaluationLogProblemReporter } from "../../src/log-insights/log-scanner";
import { EvaluationLogScannerSet } from "../../src/log-insights/log-scanner";
import { JoinOrderScannerProvider } from "../../src/log-insights/join-order";
import { join } from "path";

interface TestProblem {
  predicateName: string;
  raHash: string;
  iteration: number;
  message: string;
}

class TestProblemReporter implements EvaluationLogProblemReporter {
  public readonly problems: TestProblem[] = [];

  public reportProblem(
    predicateName: string,
    raHash: string,
    iteration: number,
    message: string,
  ): void {
    this.problems.push({
      predicateName,
      raHash,
      iteration,
      message,
    });
  }

  public log(message: string): void {
    console.log(message);
  }
}

describe("log scanners", () => {
  it("should detect bad join orders", async () => {
    const scanners = new EvaluationLogScannerSet();
    scanners.registerLogScannerProvider(new JoinOrderScannerProvider(() => 50));
    const summaryPath = join(
      __dirname,
      "data/evaluator-log-summaries/bad-join-order.jsonl",
    );
    const problemReporter = new TestProblemReporter();
    await scanners.scanLog(summaryPath, problemReporter);

    expect(problemReporter.problems.length).toBe(1);
    expect(problemReporter.problems[0].predicateName).toBe("#select#ff");
    expect(problemReporter.problems[0].raHash).toBe(
      "1bb43c97jpmuh8r2v0f9hktim63",
    );
    expect(problemReporter.problems[0].iteration).toBe(0);
    expect(problemReporter.problems[0].message).toBe(
      "Relation '#select#ff' has an inefficient join order. Its join order metric is 4961.83, which is larger than the threshold of 50.00.",
    );
  });
});
