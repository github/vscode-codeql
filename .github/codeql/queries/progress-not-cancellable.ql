/**
 * @name Using token for non-cancellable progress bar
 * @kind problem
 * @problem.severity warning
 * @id vscode-codeql/progress-not-cancellable
 * @description If we call `withProgress` without `cancellable: true` then the
 * token that is given to us should be ignored because it won't ever be cancelled.
 * This makes the code more confusing as it tries to account for cases that can't
 * happen. The fix is to either not use the token or make the progress bar cancellable.
 */

import javascript
import ProgressBar

from WithProgressCall t
where not t.isCancellable() and t.usesToken()
select t,
  "The $@ should not be used when the progress bar is not cancellable. Either stop using the $@ or mark the progress bar as cancellable.",
  t.getTokenParameter(), t.getTokenParameter().getName(), t.getTokenParameter(),
  t.getTokenParameter().getName()
