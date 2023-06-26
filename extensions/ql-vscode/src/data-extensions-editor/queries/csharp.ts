import { Query } from "./query";

export const fetchExternalApisQuery: Query = {
  applicationModeQuery: `/**
 * @name Usage of APIs coming from external libraries
 * @description A list of 3rd party APIs used in the codebase.
 * @tags telemetry
 * @kind problem
 * @id cs/telemetry/fetch-external-apis
 */

private import csharp
private import AutomodelVsCode

class ExternalApi extends CallableMethod {
  ExternalApi() {
    this.isUnboundDeclaration() and
    this.fromLibrary() and
    this.(Modifiable).isEffectivelyPublic()
  }
}

private Call aUsage(ExternalApi api) { result.getTarget().getUnboundDeclaration() = api }

from ExternalApi api, string apiName, boolean supported, Call usage
where
  apiName = api.getApiName() and
  supported = isSupported(api) and
  usage = aUsage(api)
select usage, apiName, supported.toString(), "supported", api.getFile().getBaseName(), "library"
`,
  frameworkModeQuery: `/**
 * @name Public methods
 * @description A list of APIs callable by consumers. Excludes test and generated code.
 * @tags telemetry
 * @kind problem
 * @id cs/telemetry/fetch-public-methods
 */

private import csharp
private import dotnet
private import AutomodelVsCode

class PublicMethod extends CallableMethod {
  PublicMethod() { this.fromSource() }
}

from PublicMethod publicMethod, string apiName, boolean supported
where
  apiName = publicMethod.getApiName() and
  supported = isSupported(publicMethod)
select publicMethod, apiName, supported.toString(), "supported",
  publicMethod.getFile().getBaseName(), "library"
`,
  dependencies: {
    "AutomodelVsCode.qll": `/** Provides classes and predicates related to handling APIs for the VS Code extension. */

private import csharp
private import dotnet
private import semmle.code.csharp.dispatch.Dispatch
private import semmle.code.csharp.dataflow.ExternalFlow
private import semmle.code.csharp.dataflow.FlowSummary
private import semmle.code.csharp.dataflow.internal.DataFlowImplCommon as DataFlowImplCommon
private import semmle.code.csharp.dataflow.internal.DataFlowPrivate
private import semmle.code.csharp.dataflow.internal.DataFlowDispatch as DataFlowDispatch
private import semmle.code.csharp.dataflow.internal.FlowSummaryImpl as FlowSummaryImpl
private import semmle.code.csharp.dataflow.internal.TaintTrackingPrivate
private import semmle.code.csharp.security.dataflow.flowsources.Remote

pragma[nomagic]
private predicate isTestNamespace(Namespace ns) {
  ns.getFullName()
      .matches([
          "NUnit.Framework%", "Xunit%", "Microsoft.VisualStudio.TestTools.UnitTesting%", "Moq%"
        ])
}

/**
 * A test library.
 */
class TestLibrary extends RefType {
  TestLibrary() { isTestNamespace(this.getNamespace()) }
}

/** Holds if the given callable is not worth supporting. */
private predicate isUninteresting(DotNet::Declaration c) {
  c.getDeclaringType() instanceof TestLibrary or
  c.(Constructor).isParameterless() or
  c.getDeclaringType() instanceof AnonymousClass
}

/**
 * An callable method from either the C# Standard Library, a 3rd party library, or from the source.
 */
class CallableMethod extends DotNet::Declaration {
  CallableMethod() {
    this.(Modifiable).isEffectivelyPublic() and
    not isUninteresting(this)
  }

  /**
   * Gets the unbound type, name and parameter types of this API.
   */
  bindingset[this]
  private string getSignature() {
    result =
      this.getDeclaringType().getUnboundDeclaration() + "." + this.getName() + "(" +
        parameterQualifiedTypeNamesToString(this) + ")"
  }

  /**
   * Gets the namespace of this API.
   */
  bindingset[this]
  string getNamespace() { this.getDeclaringType().hasQualifiedName(result, _) }

  /**
   * Gets the namespace and signature of this API.
   */
  bindingset[this]
  string getApiName() { result = this.getNamespace() + "#" + this.getSignature() }

  /** Gets a node that is an input to a call to this API. */
  private ArgumentNode getAnInput() {
    result
        .getCall()
        .(DataFlowDispatch::NonDelegateDataFlowCall)
        .getATarget(_)
        .getUnboundDeclaration() = this
  }

  /** Gets a node that is an output from a call to this API. */
  private DataFlow::Node getAnOutput() {
    exists(
      Call c, DataFlowDispatch::NonDelegateDataFlowCall dc, DataFlowImplCommon::ReturnKindExt ret
    |
      dc.getDispatchCall().getCall() = c and
      c.getTarget().getUnboundDeclaration() = this
    |
      result = ret.getAnOutNode(dc)
    )
  }

  /** Holds if this API has a supported summary. */
  pragma[nomagic]
  predicate hasSummary() {
    this instanceof SummarizedCallable
    or
    defaultAdditionalTaintStep(this.getAnInput(), _)
  }

  /** Holds if this API is a known source. */
  pragma[nomagic]
  predicate isSource() {
    this.getAnOutput() instanceof RemoteFlowSource or sourceNode(this.getAnOutput(), _)
  }

  /** Holds if this API is a known sink. */
  pragma[nomagic]
  predicate isSink() { sinkNode(this.getAnInput(), _) }

  /** Holds if this API is a known neutral. */
  pragma[nomagic]
  predicate isNeutral() { this instanceof FlowSummaryImpl::Public::NeutralCallable }

  /**
   * Holds if this API is supported by existing CodeQL libraries, that is, it is either a
   * recognized source, sink or neutral or it has a flow summary.
   */
  predicate isSupported() {
    this.hasSummary() or this.isSource() or this.isSink() or this.isNeutral()
  }
}

boolean isSupported(CallableMethod callableMethod) {
  callableMethod.isSupported() and result = true
  or
  not callableMethod.isSupported() and
  result = false
}
`,
  },
};
