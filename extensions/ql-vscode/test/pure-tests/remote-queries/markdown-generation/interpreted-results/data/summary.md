## Results for "Shell command built from environment values"

<details>
<summary>Query</summary>

```ql
/**
 * @name Shell command built from environment values
 * @description Building a shell command string with values from the enclosing
 *              environment may cause subtle bugs or vulnerabilities.
 * @kind path-problem
 * @problem.severity warning
 * @security-severity 6.3
 * @precision high
 * @id js/shell-command-injection-from-environment
 * @tags correctness
 *       security
 *       external/cwe/cwe-078
 *       external/cwe/cwe-088
 */

import javascript
import DataFlow::PathGraph
import semmle.javascript.security.dataflow.ShellCommandInjectionFromEnvironmentQuery

from
  Configuration cfg, DataFlow::PathNode source, DataFlow::PathNode sink, DataFlow::Node highlight,
  Source sourceNode
where
  sourceNode = source.getNode() and
  cfg.hasFlowPath(source, sink) and
  if cfg.isSinkWithHighlight(sink.getNode(), _)
  then cfg.isSinkWithHighlight(sink.getNode(), highlight)
  else highlight = sink.getNode()
select highlight, source, sink, "This shell command depends on an uncontrolled $@.", sourceNode,
  sourceNode.getSourceType()

```

</details>

### Summary

| Repository | Results |
| --- | --- |
| github/codeql | [4 result(s)](#file-github-codeql-md) |
| meteor/meteor | [1 result(s)](#file-meteor-meteor-md) |