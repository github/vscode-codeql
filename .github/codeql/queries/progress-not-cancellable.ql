/**
 * @name Using token for non-cancellable progress bar
 * @kind problem
 * @problem.severity warning
 * @id vscode-codeql/progress-not-cancellable
 * @description If we call `withProgress` with `cancellable: false` then the
 * token that is given to us should be ignored because it won't ever be cancelled.
 */

import javascript
import ProgressBar

from ProgressBar t
where not t.isCancellable() and t.usesToken()
select t, "The token should not be used when the progress bar is not cancelable"
