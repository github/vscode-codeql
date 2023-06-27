import { Query } from "./query";

export const fetchExternalApisQuery: Query = {
  applicationModeQuery: `/**
 * @name Usage of APIs coming from external libraries
 * @description A list of 3rd party APIs used in the codebase. Excludes test and generated code.
 * @tags telemetry
 * @kind problem
 * @id java/telemetry/fetch-external-apis
 */

import java
import AutomodelVsCode

class ExternalApi extends CallableMethod {
  ExternalApi() { not this.fromSource() }
}

private Call aUsage(ExternalApi api) {
  result.getCallee().getSourceDeclaration() = api and
  not result.getFile() instanceof GeneratedFile
}

from ExternalApi externalApi, string apiName, boolean supported, Call usage
where
  apiName = externalApi.getApiName() and
  supported = isSupported(externalApi) and
  usage = aUsage(externalApi)
select usage, apiName, supported.toString(), "supported", externalApi.jarContainer(), "library"
`,
  frameworkModeQuery: `/**
 * @name Public methods
 * @description A list of APIs callable by consumers. Excludes test and generated code.
 * @tags telemetry
 * @kind problem
 * @id java/telemetry/fetch-public-methods
 */

import java
import AutomodelVsCode

class PublicMethodFromSource extends CallableMethod {
  PublicMethodFromSource() { this.isPublic() and this.fromSource() }
}

from PublicMethodFromSource publicMethod, string apiName, boolean supported
where
  apiName = publicMethod.getApiName() and
  supported = isSupported(publicMethod)
select publicMethod, apiName, supported.toString(), "supported",
  publicMethod.getCompilationUnit().getParentContainer().getBaseName(), "library"
`,
  dependencies: {
    "AutomodelVsCode.qll": `/** Provides classes and predicates related to handling APIs for the VS Code extension. */

private import java
private import semmle.code.java.dataflow.DataFlow
private import semmle.code.java.dataflow.ExternalFlow
private import semmle.code.java.dataflow.FlowSources
private import semmle.code.java.dataflow.FlowSummary
private import semmle.code.java.dataflow.internal.DataFlowPrivate
private import semmle.code.java.dataflow.internal.FlowSummaryImpl as FlowSummaryImpl
private import semmle.code.java.dataflow.TaintTracking
private import semmle.code.java.dataflow.internal.ModelExclusions

/** Holds if the given callable/method is not worth supporting. */
private predicate isUninteresting(Callable c) {
  c.getDeclaringType() instanceof TestLibrary or
  c.(Constructor).isParameterless() or
  c.getDeclaringType() instanceof AnonymousClass
}

/**
 * A callable method from either the Standard Library, a 3rd party library or from the source.
 */
class CallableMethod extends Method {
  CallableMethod() { not isUninteresting(this) }

  /**
   * Gets information about the external API in the form expected by the MaD modeling framework.
   */
  string getApiName() {
    result =
      this.getDeclaringType().getPackage() + "." + this.getDeclaringType().nestedName() +
        "#" + this.getName() + paramsString(this)
  }

  private string getJarName() {
    result = this.getCompilationUnit().getParentContainer*().(JarFile).getBaseName()
  }

  /**
   * Gets the jar file containing this API. Normalizes the Java Runtime to "rt.jar" despite the presence of modules.
   */
  string jarContainer() {
    result = this.getJarName()
    or
    not exists(this.getJarName()) and result = "rt.jar"
  }

  /** Gets a node that is an input to a call to this API. */
  private DataFlow::Node getAnInput() {
    exists(Call call | call.getCallee().getSourceDeclaration() = this |
      result.asExpr().(Argument).getCall() = call or
      result.(ArgumentNode).getCall().asCall() = call
    )
  }

  /** Gets a node that is an output from a call to this API. */
  private DataFlow::Node getAnOutput() {
    exists(Call call | call.getCallee().getSourceDeclaration() = this |
      result.asExpr() = call or
      result.(DataFlow::PostUpdateNode).getPreUpdateNode().(ArgumentNode).getCall().asCall() = call
    )
  }

  /** Holds if this API has a supported summary. */
  pragma[nomagic]
  predicate hasSummary() {
    this = any(SummarizedCallable sc).asCallable() or
    TaintTracking::localAdditionalTaintStep(this.getAnInput(), _)
  }

  pragma[nomagic]
  predicate isSource() {
    this.getAnOutput() instanceof RemoteFlowSource or sourceNode(this.getAnOutput(), _)
  }

  /** Holds if this API is a known sink. */
  pragma[nomagic]
  predicate isSink() { sinkNode(this.getAnInput(), _) }

  /** Holds if this API is a known neutral. */
  pragma[nomagic]
  predicate isNeutral() { this = any(FlowSummaryImpl::Public::NeutralCallable nsc).asCallable() }

  /**
   * Holds if this API is supported by existing CodeQL libraries, that is, it is either a
   * recognized source, sink or neutral or it has a flow summary.
   */
  predicate isSupported() {
    this.hasSummary() or this.isSource() or this.isSink() or this.isNeutral()
  }
}

boolean isSupported(CallableMethod method) {
  method.isSupported() and result = true
  or
  not method.isSupported() and result = false
}
`,
  },
};
