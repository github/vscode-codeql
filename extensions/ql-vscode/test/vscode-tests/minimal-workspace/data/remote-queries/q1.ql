/**
 * @name MRVA Integration test 2
 * @kind problem
 * @problem.severity warning
 * @id javascript/integration-test-2
 */
import javascript

from MemberDeclaration md
where md.getName() = "refresh"
select md, "Refresh method"
