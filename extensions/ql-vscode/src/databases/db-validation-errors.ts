export enum DbConfigValidationErrorKind {
  InvalidJson = "InvalidJson",
  InvalidConfig = "InvalidConfig",
  DuplicateNames = "DuplicateNames",
}

export interface DbConfigValidationError {
  kind: DbConfigValidationErrorKind;
  message: string;
}
