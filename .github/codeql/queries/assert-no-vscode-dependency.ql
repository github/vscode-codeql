/**
 * @name Unwanted dependency on vscode API
 * @kind path-problem
 * @problem.severity error
 * @id vscode-codeql/assert-no-vscode-dependency
 * @description The modules stored under `common` should not have dependencies on the VS Code API
 */

import javascript

class VSCodeImport extends ImportDeclaration {
  VSCodeImport() { this.getImportedPath().getValue() = "vscode" }
}

class CommonFile extends File {
  CommonFile() {
    this.getRelativePath().regexpMatch(".*/src/common/.*") and
    not this.getRelativePath().regexpMatch(".*/vscode/.*")
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
  m.getFile() instanceof CommonFile and
  edges+(m, v)
select m, m, v,
  "This module is in the 'common' directory but has a transitive dependency on the vscode API imported $@",
  v, "here"
