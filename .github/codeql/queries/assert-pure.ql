/**
 * @name Unwanted dependency on vscode API
 * @kind problem
 * @problem.severity error
 * @id vscode-codeql/assert-pure
 * @description The modules stored under `pure` and tested in the `pure-tests`
 * are intended to be "pure".
 */
import javascript

class VSCodeImport extends ASTNode {
  VSCodeImport() {
    this.(Import).getImportedPath().getValue() = "vscode"
  }
}

from Module m, VSCodeImport v
where
  m.getFile().getRelativePath().regexpMatch(".*src/pure/.*")  and
  m.getAnImportedModule*().getAnImport() = v
select m, "This module is not pure: it has a transitive dependency on the vscode API imported $@", v, "here"
