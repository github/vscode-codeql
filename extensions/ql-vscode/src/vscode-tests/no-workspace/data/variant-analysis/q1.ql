/**
 * @name Variant Analysis Integration Test 2
 * @kind problem
 * @problem.severity warning
 * @id ruby/example/empty-block
 */

import ruby

from Block b
where b.getNumberOfStatements() = 0
select b, "This is an empty block."
