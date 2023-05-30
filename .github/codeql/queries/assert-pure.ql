/**
 * @name Unwanted dependency on vscode API
 * @kind path-problem
 * @problem.severity error
 * @id vscode-codeql/assert-pure
 * @description The modules stored under `pure` and tested in the `pure-tests`
 * are intended to be "pure".
 */

import javascript

class VSCodeImport extends ImportDeclaration {
  VSCodeImport() { this.getImportedPath().getValue() = "vscode" }
}

class PureFile extends File {
  PureFile() {
    (
      this.getRelativePath().regexpMatch(".*/src/pure/.*") or
      this.getRelativePath().regexpMatch(".*/src/common/.*")
    ) and
    not this.getRelativePath().regexpMatch(".*/src/common/vscode/.*")
  }
}

Import getANonTypeOnlyImport(Module m) {
  result = m.getAnImport() and not result.(ImportDeclaration).isTypeOnly()
}

query predicate edges(AstNode a, AstNode b) {
  getANonTypeOnlyImport(a) = b or
  a.(Import).getImportedModule() = b
}

from Module m, VSCodeImport v
where
  m.getFile() instanceof PureFile and
  edges+(m, v)
select m, m, v,
  "This module is not pure: it has a transitive dependency on the vscode API imported $@", v, "here"
