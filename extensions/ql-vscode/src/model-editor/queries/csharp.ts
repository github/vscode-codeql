import { Query } from "./query";

export const fetchExternalApisQuery: Query = {
  applicationModeQuery: `/**
 * @name Fetch endpoints for use in the model editor (application mode)
 * @description A list of 3rd party endpoints (methods and attributes) used in the codebase. Excludes test and generated code.
 * @kind table
 * @id csharp/utils/modeleditor/application-mode-endpoints
 * @tags modeleditor endpoints application-mode
 */

import csharp
import ApplicationModeEndpointsQuery
import ModelEditor

private Call aUsage(ExternalEndpoint api) { result.getTarget().getUnboundDeclaration() = api }

from ExternalEndpoint endpoint, boolean supported, Call usage, string type, string classification
where
  supported = isSupported(endpoint) and
  usage = aUsage(endpoint) and
  type = supportedType(endpoint) and
  classification = methodClassification(usage)
select usage, endpoint.getNamespace(), endpoint.getTypeName(), endpoint.getName(),
  endpoint.getParameterTypes(), supported, endpoint.dllName(), endpoint.dllVersion(), type,
  classification
`,
  frameworkModeQuery: `/**
 * @name Fetch endpoints for use in the model editor (framework mode)
 * @description A list of endpoints accessible (methods and attributes) for consumers of the library. Excludes test and generated code.
 * @kind table
 * @id csharp/utils/modeleditor/framework-mode-endpoints
 * @tags modeleditor endpoints framework-mode
 */

import csharp
import FrameworkModeEndpointsQuery
import ModelEditor

from PublicEndpointFromSource endpoint, boolean supported, string type
where
  supported = isSupported(endpoint) and
  type = supportedType(endpoint)
select endpoint, endpoint.getNamespace(), endpoint.getTypeName(), endpoint.getName(),
  endpoint.getParameterTypes(), supported, endpoint.getFile().getBaseName(), type
`,
  dependencies: {
    "ApplicationModeEndpointsQuery.qll": `private import csharp
private import semmle.code.csharp.dataflow.ExternalFlow as ExternalFlow
private import semmle.code.csharp.dataflow.internal.DataFlowDispatch as DataFlowDispatch
private import semmle.code.csharp.dataflow.internal.DataFlowPrivate
private import semmle.code.csharp.dataflow.internal.TaintTrackingPrivate
private import semmle.code.csharp.security.dataflow.flowsources.Remote
private import ModelEditor

/**
 * A class of effectively public callables in library code.
 */
class ExternalEndpoint extends Endpoint {
  ExternalEndpoint() { this.fromLibrary() }

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
    exists(Call c, DataFlowDispatch::NonDelegateDataFlowCall dc |
      dc.getDispatchCall().getCall() = c and
      c.getTarget().getUnboundDeclaration() = this
    |
      result = DataFlowDispatch::getAnOutNode(dc, _)
    )
  }

  override predicate hasSummary() {
    Endpoint.super.hasSummary()
    or
    defaultAdditionalTaintStep(this.getAnInput(), _)
  }

  override predicate isSource() {
    this.getAnOutput() instanceof RemoteFlowSource or ExternalFlow::sourceNode(this.getAnOutput(), _)
  }

  override predicate isSink() { ExternalFlow::sinkNode(this.getAnInput(), _) }
}
`,
    "FrameworkModeEndpointsQuery.qll": `private import csharp
private import semmle.code.csharp.frameworks.Test
private import ModelEditor

/**
 * A class of effectively public callables from source code.
 */
class PublicEndpointFromSource extends Endpoint {
  PublicEndpointFromSource() { this.fromSource() and not this.getFile() instanceof TestFile }

  override predicate isSource() { this instanceof SourceCallable }

  override predicate isSink() { this instanceof SinkCallable }
}`,
    "ModelEditor.qll": `/** Provides classes and predicates related to handling APIs for the VS Code extension. */

private import csharp
private import semmle.code.csharp.dataflow.FlowSummary
private import semmle.code.csharp.dataflow.internal.DataFlowPrivate
private import semmle.code.csharp.dataflow.internal.FlowSummaryImpl as FlowSummaryImpl
private import semmle.code.csharp.frameworks.Test

/** Holds if the given callable is not worth supporting. */
private predicate isUninteresting(Callable c) {
  c.getDeclaringType() instanceof TestLibrary or
  c.(Constructor).isParameterless() or
  c.getDeclaringType() instanceof AnonymousClass
}

/**
 * A callable method or accessor from either the C# Standard Library, a 3rd party library, or from the source.
 */
class Endpoint extends Callable {
  Endpoint() {
    [this.(Modifiable), this.(Accessor).getDeclaration()].isEffectivelyPublic() and
    not isUninteresting(this) and
    this.isUnboundDeclaration()
  }

  /**
   * Gets the namespace of this endpoint.
   */
  bindingset[this]
  string getNamespace() { this.getDeclaringType().hasQualifiedName(result, _) }

  /**
   * Gets the unbound type name of this endpoint.
   */
  bindingset[this]
  string getTypeName() { result = nestedName(this.getDeclaringType().getUnboundDeclaration()) }

  /**
   * Gets the parameter types of this endpoint.
   */
  bindingset[this]
  string getParameterTypes() { result = "(" + parameterQualifiedTypeNamesToString(this) + ")" }

  private string getDllName() { result = this.getLocation().(Assembly).getName() }

  private string getDllVersion() { result = this.getLocation().(Assembly).getVersion().toString() }

  string dllName() {
    result = this.getDllName()
    or
    not exists(this.getDllName()) and result = this.getFile().getBaseName()
  }

  string dllVersion() {
    result = this.getDllVersion()
    or
    not exists(this.getDllVersion()) and result = ""
  }

  /** Holds if this API has a supported summary. */
  pragma[nomagic]
  predicate hasSummary() { this instanceof SummarizedCallable }

  /** Holds if this API is a known source. */
  pragma[nomagic]
  abstract predicate isSource();

  /** Holds if this API is a known sink. */
  pragma[nomagic]
  abstract predicate isSink();

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

boolean isSupported(Endpoint endpoint) {
  if endpoint.isSupported() then result = true else result = false
}

string supportedType(Endpoint endpoint) {
  endpoint.isSink() and result = "sink"
  or
  endpoint.isSource() and result = "source"
  or
  endpoint.hasSummary() and result = "summary"
  or
  endpoint.isNeutral() and result = "neutral"
  or
  not endpoint.isSupported() and result = ""
}

string methodClassification(Call method) {
  method.getFile() instanceof TestFile and result = "test"
  or
  not method.getFile() instanceof TestFile and
  result = "source"
}

/**
 * Gets the nested name of the type \`t\`.
 *
 * If the type is not a nested type, the result is the same as \`getName()\`.
 * Otherwise the name of the nested type is prefixed with a \`+\` and appended to
 * the name of the enclosing type, which might be a nested type as well.
 */
private string nestedName(Type t) {
  not exists(t.getDeclaringType().getUnboundDeclaration()) and
  result = t.getName()
  or
  nestedName(t.getDeclaringType().getUnboundDeclaration()) + "+" + t.getName() = result
}

// Temporary copy of csharp/ql/src/Telemetry/TestLibrary.qll

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

// Temporary copy of csharp/ql/lib/semmle/code/csharp/dataflow/ExternalFlow.qll
private import semmle.code.csharp.dataflow.internal.FlowSummaryImplSpecific

/**
 * A callable where there exists a MaD sink model that applies to it.
 */
class SinkCallable extends Callable {
  SinkCallable() { sinkElement(this, _, _, _) }
}

/**
 * A callable where there exists a MaD source model that applies to it.
 */
class SourceCallable extends Callable {
  SourceCallable() { sourceElement(this, _, _, _) }
}
`,
  },
};
