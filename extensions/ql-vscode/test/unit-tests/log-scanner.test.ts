import { scanAndReportJoinOrderProblems } from "../../src/log-insights/join-order";
import type { EvaluationLogProblemReporter } from "../../src/log-insights/log-scanner";
import { join } from "path";

interface TestProblem {
  predicateName: string;
  raHash: string;
  order: string | undefined;
  message: string;
}

class TestProblemReporter implements EvaluationLogProblemReporter {
  public readonly problems: TestProblem[] = [];

  public reportProblemNonRecursive(
    predicateName: string,
    raHash: string,
    message: string,
  ): void {
    this.problems.push({
      predicateName,
      raHash,
      order: undefined,
      message,
    });
  }
  public reportProblemForRecursionSummary(
    predicateName: string,
    raHash: string,
    order: string,
    message: string,
  ): void {
    this.problems.push({
      predicateName,
      raHash,
      order,
      message,
    });
  }

  public log(message: string): void {
    console.log(message);
  }
}

describe("log scanners", () => {
  it("should detect bad join orders", async () => {
    const summaryPath = join(
      __dirname,
      "data/evaluator-log-summaries/bad-join-order.jsonl",
    );
    const problemReporter = new TestProblemReporter();
    await scanAndReportJoinOrderProblems(summaryPath, problemReporter, 50);

    expect(problemReporter.problems.length).toBe(2);

    expect(problemReporter.problems[0].predicateName).toBe(
      "Enclosing::exprEnclosingElement#c50c5fbf#ff",
    );
    expect(problemReporter.problems[0].raHash).toBe(
      "7cc60wtoigvl1lheqqa12d8fmi4",
    );
    expect(problemReporter.problems[0].order).toBe("order_500000");
    expect(problemReporter.problems[0].message).toBe(
      "The order_500000 pipeline for 'Enclosing::exprEnclosingElement#c50c5fbf#ff@7cc60wto' has an inefficient join order. Its join order metric is 98.07, which is larger than the threshold of 50.00.",
    );

    expect(problemReporter.problems[1].predicateName).toBe("#select#ff");
    expect(problemReporter.problems[1].raHash).toBe(
      "1bb43c97jpmuh8r2v0f9hktim63",
    );
    expect(problemReporter.problems[1].order).toBeUndefined();
    expect(problemReporter.problems[1].message).toBe(
      "'#select#ff@1bb43c97' has an inefficient join order. Its join order metric is 4961.83, which is larger than the threshold of 50.00.",
    );
  });
});
