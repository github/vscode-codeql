import * as fs from "fs";
import { Protocol as P } from "devtools-protocol";

interface RAHashable {
  raHash: string;
  completionTime: string;
  completionTimeUs: number;
  evaluationStrategy: string;
  dependencies?: any;
  millis: number;
  predicateName: string;
}
interface RAIndexed {
  ra: RAHashable;
  index: number;
}

function indexRaElements(ras: RAHashable[]): Map<string, RAIndexed> {
  const raHashIndex = new Map<string, RAIndexed>();

  let idx = 1;
  for (const ra of ras) {
    // every row should have a raHash
    if (!raHashIndex.has(ra.raHash)) {
      raHashIndex.set(ra.raHash, {
        index: idx,
        ra,
      });

      idx++;
    }
  }
  return raHashIndex;
}

export function convertJSONSummaryEvaluatorLog(
  evaluatorLog: string,
  outFile: string,
): string {
  const data = fs.readFileSync(evaluatorLog, "utf8");

  // split up the log
  const parts = data.split("\n\n");
  let raRows: RAHashable[] = [];

  let tsMax = 0;
  let tsMin = 0;

  for (const row of parts) {
    const j = JSON.parse(row);

    if (!("completionTime" in j)) {
      continue;
    }

    if (!("predicateName" in j)) {
      continue;
    }

    j.completionTimeUs = new Date(j.completionTime).getTime() * 1000;

    const parsed = j as RAHashable;

    // only let these rows contribute
    if (
      !(
        parsed.evaluationStrategy === "COMPUTE_SIMPLE" ||
        parsed.evaluationStrategy === "COMPUTE_RECURSIVE" ||
        parsed.evaluationStrategy === "EXTENSIONAL"
      )
    ) {
      continue;
    }

    // calculate the min and max while we are at it.
    if (tsMax < parsed.completionTimeUs) {
      tsMax = parsed.completionTimeUs;
    }

    if (tsMin === 0 || parsed.completionTimeUs < tsMin) {
      tsMin = parsed.completionTimeUs;
    }

    raRows.push(parsed);
  }

  // sort based on timestamp
  raRows = raRows.sort((a, b) => a.completionTimeUs - b.completionTimeUs);

  const raDatabase: Map<string, RAIndexed> = indexRaElements(raRows);

  // filter the raRows dependencies since it is possible some of the dependencies
  // reference things that may not exist in the final graph
  raRows.forEach((e) => {
    const deps: any = {};

    for (const k in e.dependencies) {
      if (raDatabase.has(e.dependencies[k])) {
        deps[k] = e.dependencies[k];
      }
    }

    e.dependencies = deps;
  });

  // build up graph
  //console.log(raDatabase.size)

  const profile: P.Profiler.Profile = {
    nodes: [],
    startTime: tsMin,
    endTime: tsMax,
    samples: [],
    timeDeltas: [],
  };

  ///
  /// Compute nodes
  ///

  profile.nodes = raRows.map((e) => {
    // compute the dependencies
    const dependencies: number[] = [];

    if (e.dependencies) {
      for (const k in e.dependencies) {
        dependencies.push(raDatabase.get(e.dependencies[k])!.index);
      }
    }

    const n: P.Profiler.ProfileNode = {
      id: raDatabase.get(e.raHash)!.index,
      callFrame: {
        functionName: e.predicateName,
        scriptId: "0",
        url: "",
        lineNumber: 0,
        columnNumber: 0,
      },
      hitCount: 1, // everything will have just one hit.
      children: dependencies,
    };
    return n;
  });
  ///
  /// Compute samples -- this is really just every id once.
  ///
  profile.samples = raRows.map((e) => raDatabase.get(e.raHash)!.index);

  ///
  /// Deltas -- this is the difference in time between the two samples
  ///
  profile.timeDeltas = raRows.map((e) => e.millis * 1000);

  fs.writeFileSync(outFile, JSON.stringify(profile));

  return outFile;
}
