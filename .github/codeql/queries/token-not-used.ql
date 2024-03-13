/**
 * @name Don't ignore the token for a cancelable progress bar
 * @kind problem
 * @problem.severity warning
 * @id vscode-codeql/token-not-used
 * @description If we call `withProgress` with `cancellable: true` but then
 * ignore the token that is given to us, it will lead to a poor user experience
 * because the progress bar will appear to be canceled but it will not actually
 * affect the background process.
 */

import javascript
import ProgressBar

from ProgressBar t
where t.isCancellable() and not t.usesToken()
select t, "This progress bar is $@ but the token is not used", t.getCancellableProperty(), "cancellable"
