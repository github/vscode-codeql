/**
 * @name Variant Analysis Integration Test 1
 * @kind problem
 * @problem.severity warning
 * @id javascript/variant-analysis-integration-test-1
 */
import javascript

from MemberDeclaration md
where md.getName() = "dispose"
select md, "Dispose method"
