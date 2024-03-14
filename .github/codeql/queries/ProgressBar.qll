import javascript

abstract class ProgressBar extends CallExpr {
  ProgressBar() { any() }

  abstract Function getCallback();

  abstract ObjectExpr getOptions();

  predicate usesToken() { exists(this.getTokenParameter()) }

  Parameter getTokenParameter() { result = this.getCallback().getParameter(1) }

  Property getCancellableProperty() { result = this.getOptions().getPropertyByName("cancellable") }

  predicate isCancellable() {
    this.getCancellableProperty().getInit().(BooleanLiteral).getBoolValue() =
      true
  }
}

class WithProgressCall extends ProgressBar {
  WithProgressCall() { this.getCalleeName() = "withProgress" }

  override Function getCallback() { result = this.getArgument(0) }

  override ObjectExpr getOptions() { result = this.getArgument(1) }
}

class WithInheritedProgressCall extends ProgressBar {
  WithInheritedProgressCall() { this.getCalleeName() = "withInheritedProgress" }

  override Function getCallback() { result = this.getArgument(1) }

  override ObjectExpr getOptions() { result = this.getArgument(2) }
}
