/**
 * @name Don't ignore the token for a cancellable progress bar
 * @kind problem
 * @problem.severity warning
 * @id vscode-codeql/token-not-used
 * @description If we call `withProgress` with `cancellable: true` but then
 * ignore the token that is given to us, it will lead to a poor user experience
 * because the progress bar will appear to be canceled but it will not actually
 * affect the background process. Either check the token and respect when it
 * has been cancelled, or mark the progress bar as not cancellable.
 */

import javascript
import ProgressBar

from WithProgressCall t
where t.isCancellable() and not t.usesToken()
select t, "This progress bar is $@ but the token is not used. Either use the token or mark the progress bar as not cancellable.", t.getCancellableProperty(), "cancellable"
