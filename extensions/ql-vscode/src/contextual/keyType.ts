export enum KeyType {
  DefinitionQuery = "DefinitionQuery",
  ReferenceQuery = "ReferenceQuery",
  PrintAstQuery = "PrintAstQuery",
  PrintCfgQuery = "PrintCfgQuery",
}

export function tagOfKeyType(keyType: KeyType): string {
  switch (keyType) {
    case KeyType.DefinitionQuery:
      return "ide-contextual-queries/local-definitions";
    case KeyType.ReferenceQuery:
      return "ide-contextual-queries/local-references";
    case KeyType.PrintAstQuery:
      return "ide-contextual-queries/print-ast";
    case KeyType.PrintCfgQuery:
      return "ide-contextual-queries/print-cfg";
  }
}

export function nameOfKeyType(keyType: KeyType): string {
  switch (keyType) {
    case KeyType.DefinitionQuery:
      return "definitions";
    case KeyType.ReferenceQuery:
      return "references";
    case KeyType.PrintAstQuery:
      return "print AST";
    case KeyType.PrintCfgQuery:
      return "print CFG";
  }
}

export function kindOfKeyType(keyType: KeyType): string {
  switch (keyType) {
    case KeyType.DefinitionQuery:
    case KeyType.ReferenceQuery:
      return "definitions";
    case KeyType.PrintAstQuery:
    case KeyType.PrintCfgQuery:
      return "graph";
  }
}
