import { Query } from "./query";

export const fetchExternalApisQuery: Query = {
  applicationModeQuery: `/**
 * @name Fetch endpoints for use in the model editor (application mode)
 * @description A list of 3rd party endpoints (methods) used in the codebase. Excludes test and generated code.
 * @kind table
 * @id java/utils/modeleditor/application-mode-endpoints
 * @tags modeleditor endpoints application-mode
 */

private import java
private import ApplicationModeEndpointsQuery
private import ModelEditor

private Call aUsage(ExternalEndpoint endpoint) {
  result.getCallee().getSourceDeclaration() = endpoint
}

from ExternalEndpoint endpoint, boolean supported, Call usage, string type, string classification
where
  supported = isSupported(endpoint) and
  usage = aUsage(endpoint) and
  type = supportedType(endpoint) and
  classification = usageClassification(usage)
select usage, endpoint.getPackageName(), endpoint.getTypeName(), endpoint.getName(),
  endpoint.getParameterTypes(), supported, endpoint.jarContainer(), endpoint.jarVersion(), type,
  classification
`,
  frameworkModeQuery: `/**
 * @name Fetch endpoints for use in the model editor (framework mode)
 * @description A list of endpoints accessible (methods) for consumers of the library. Excludes test and generated code.
 * @kind table
 * @id java/utils/modeleditor/framework-mode-endpoints
 * @tags modeleditor endpoints framework-mode
 */

private import java
private import FrameworkModeEndpointsQuery
private import ModelEditor

from PublicEndpointFromSource endpoint, boolean supported, string type
where
  supported = isSupported(endpoint) and
  type = supportedType(endpoint)
select endpoint, endpoint.getPackageName(), endpoint.getTypeName(), endpoint.getName(),
  endpoint.getParameterTypes(), supported,
  endpoint.getCompilationUnit().getParentContainer().getBaseName(), type
`,
  dependencies: {
    "ApplicationModeEndpointsQuery.qll": `private import java
private import semmle.code.java.dataflow.ExternalFlow
private import semmle.code.java.dataflow.FlowSources
private import semmle.code.java.dataflow.internal.DataFlowPrivate
private import ModelEditor

/**
 * A class of effectively public callables in library code.
 */
class ExternalEndpoint extends Endpoint {
  ExternalEndpoint() { not this.fromSource() }

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

  override predicate hasSummary() {
    Endpoint.super.hasSummary()
    or
    TaintTracking::localAdditionalTaintStep(this.getAnInput(), _)
  }

  override predicate isSource() {
    this.getAnOutput() instanceof RemoteFlowSource or sourceNode(this.getAnOutput(), _)
  }

  override predicate isSink() { sinkNode(this.getAnInput(), _) }
}
`,
    "FrameworkModeEndpointsQuery.qll": `private import java
private import semmle.code.java.dataflow.internal.DataFlowPrivate
private import semmle.code.java.dataflow.internal.FlowSummaryImplSpecific
private import semmle.code.java.dataflow.internal.ModelExclusions
private import ModelEditor

/**
 * A class of effectively public callables from source code.
 */
class PublicEndpointFromSource extends Endpoint, ModelApi {
  override predicate isSource() { sourceElement(this, _, _, _) }

  override predicate isSink() { sinkElement(this, _, _, _) }
}
`,
    "ModelEditor.qll": `/** Provides classes and predicates related to handling APIs for the VS Code extension. */

private import java
private import semmle.code.java.dataflow.ExternalFlow
private import semmle.code.java.dataflow.FlowSummary
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
class Endpoint extends Callable {
  Endpoint() { not isUninteresting(this) }

  /**
   * Gets the package name of this endpoint.
   */
  string getPackageName() { result = this.getDeclaringType().getPackage().getName() }

  /**
   * Gets the type name of this endpoint.
   */
  string getTypeName() { result = this.getDeclaringType().nestedName() }

  /**
   * Gets the parameter types of this endpoint.
   */
  string getParameterTypes() { result = paramsString(this) }

  private string getJarName() {
    result = this.getCompilationUnit().getParentContainer*().(JarFile).getBaseName()
  }

  private string getJarVersion() {
    result = this.getCompilationUnit().getParentContainer*().(JarFile).getSpecificationVersion()
  }

  /**
   * Gets the jar file containing this API. Normalizes the Java Runtime to "rt.jar" despite the presence of modules.
   */
  string jarContainer() {
    result = this.getJarName()
    or
    not exists(this.getJarName()) and result = "rt.jar"
  }

  /**
   * Gets the version of the JAR file containing this API. Empty if no version is found in the JAR.
   */
  string jarVersion() {
    result = this.getJarVersion()
    or
    not exists(this.getJarVersion()) and result = ""
  }

  /** Holds if this API has a supported summary. */
  pragma[nomagic]
  predicate hasSummary() { this = any(SummarizedCallable sc).asCallable() }

  /** Holds if this API is a known source. */
  pragma[nomagic]
  abstract predicate isSource();

  /** Holds if this API is a known sink. */
  pragma[nomagic]
  abstract predicate isSink();

  /** Holds if this API is a known neutral. */
  pragma[nomagic]
  predicate isNeutral() {
    exists(string namespace, string type, string name, string signature |
      neutralModel(namespace, type, name, signature, _, _) and
      this = interpretElement(namespace, type, false, name, signature, "")
    )
  }

  /**
   * Holds if this API is supported by existing CodeQL libraries, that is, it is either a
   * recognized source, sink or neutral or it has a flow summary.
   */
  predicate isSupported() {
    this.hasSummary() or this.isSource() or this.isSink() or this.isNeutral()
  }
}

boolean isSupported(Endpoint endpoint) {
  endpoint.isSupported() and result = true
  or
  not endpoint.isSupported() and result = false
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

string usageClassification(Call usage) {
  isInTestFile(usage.getLocation().getFile()) and result = "test"
  or
  usage.getFile() instanceof GeneratedFile and result = "generated"
  or
  not isInTestFile(usage.getLocation().getFile()) and
  not usage.getFile() instanceof GeneratedFile and
  result = "source"
}

// Temporarily copied from java/ql/lib/semmle/code/java/dataflow/internal/ModelExclusions.qll
predicate isInTestFile(File file) {
  file.getAbsolutePath().matches(["%/test/%", "%/guava-tests/%", "%/guava-testlib/%"]) and
  not file.getAbsolutePath().matches(["%/ql/test/%", "%/ql/automodel/test/%"]) // allows our test cases to work
}
`,
  },
};
