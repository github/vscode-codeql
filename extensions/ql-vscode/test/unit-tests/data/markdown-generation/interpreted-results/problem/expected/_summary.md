### Results for "Inefficient regular expression"

<details>
<summary>Query</summary>

```ql
/**
 * @name Inefficient regular expression
 * @description A regular expression that requires exponential time to match certain inputs
 *              can be a performance bottleneck, and may be vulnerable to denial-of-service
 *              attacks.
 * @kind problem
 * @problem.severity error
 * @security-severity 7.5
 * @precision high
 * @id js/redos
 * @tags security
 *       external/cwe/cwe-1333
 *       external/cwe/cwe-730
 *       external/cwe/cwe-400
 */

import javascript
import semmle.javascript.security.performance.ReDoSUtil
import semmle.javascript.security.performance.ExponentialBackTracking

from RegExpTerm t, string pump, State s, string prefixMsg
where hasReDoSResult(t, pump, s, prefixMsg)
select t,
  "This part of the regular expression may cause exponential backtracking on strings " + prefixMsg +
    "containing many repetitions of '" + pump + "'."

```

</details>

<br />

### Summary

| Repository | Results |
| --- | --- |
| github/codeql | [1 result(s)](#file-result-1-github-codeql-md) |
| meteor/meteor | [5 result(s)](#file-result-2-meteor-meteor-md) |
