import javascript

class WithProgressCall extends CallExpr {
  WithProgressCall() { this.getCalleeName() = "withProgress" }

  predicate usesToken() { exists(this.getTokenParameter()) }

  Parameter getTokenParameter() { result = this.getArgument(0).(Function).getParameter(1) }

  Property getCancellableProperty() { result = this.getArgument(1).(ObjectExpr).getPropertyByName("cancellable") }

  predicate isCancellable() {
    this.getCancellableProperty().getInit().(BooleanLiteral).getBoolValue() =
      true
  }
}
