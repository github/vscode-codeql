### Results for "Contradictory guard nodes"

<details>
<summary>Query</summary>

```ql
/**
 * @name Contradictory guard nodes
 * 
 * @description Snippet from "UselessComparisonTest.ql"
 */

import javascript

/**
 * Holds if there are any contradictory guard nodes in `container`.
 *
 * We use this to restrict reachability analysis to a small set of containers.
 */
predicate hasContradictoryGuardNodes(StmtContainer container) {
  exists(ConditionGuardNode guard |
    RangeAnalysis::isContradictoryGuardNode(guard) and
    container = guard.getContainer()
  )
}

from StmtContainer c
where hasContradictoryGuardNodes(c)
select c, c.getNumLines()
```

</details>

<br />

### Summary

| Repository | Results |
| --- | --- |
| github/codeql | [22 result(s)](#file-result-1-github-codeql-md) |
| meteor/meteor | [2 result(s)](#file-result-2-meteor-meteor-md) |
