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

private Call aUsage(ExternalApi api) { result.getCallee().getSourceDeclaration() = api }

from
  ExternalApi externalApi, string apiName, boolean supported, Call usage, string type,
  string classification
where
  apiName = externalApi.getApiName() and
  supported = isSupported(externalApi) and
  usage = aUsage(externalApi) and
  type = supportedType(externalApi) and
  classification = methodClassification(usage)
select usage, apiName, supported.toString(), "supported", externalApi.jarContainer(),
  externalApi.jarVersion(), type, "type", classification, "classification"
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

class PublicMethodFromSource extends CallableMethod, ModelApi { }

from PublicMethodFromSource publicMethod, string apiName, boolean supported, string type
where
  apiName = publicMethod.getApiName() and
  supported = isSupported(publicMethod) and
  type = supportedType(publicMethod)
select publicMethod, apiName, supported.toString(), "supported",
  publicMethod.getCompilationUnit().getParentContainer().getBaseName(), "library", type, "type",
  "unknown", "classification"
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
class CallableMethod extends Callable {
  CallableMethod() { not isUninteresting(this) }

  /**
   * Gets information about the external API in the form expected by the MaD modeling framework.
   */
  string getApiName() {
    result =
      this.getDeclaringType().getPackage() + "." + this.getDeclaringType().nestedName() + "#" +
        this.getName() + paramsString(this)
  }

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

string supportedType(CallableMethod method) {
  method.isSink() and result = "sink"
  or
  method.isSource() and result = "source"
  or
  method.hasSummary() and result = "summary"
  or
  method.isNeutral() and result = "neutral"
  or
  not method.isSupported() and result = ""
}

string methodClassification(Call method) {
  isInTestFile(method.getLocation().getFile()) and result = "test"
  or
  method.getFile() instanceof GeneratedFile and result = "generated"
  or
  not isInTestFile(method.getLocation().getFile()) and
  not method.getFile() instanceof GeneratedFile and
  result = "source"
}

// The below is a copy of https://github.com/github/codeql/blob/249f9f863db1e94e3c46ca85b49fb0ec32f8ca92/java/ql/lib/semmle/code/java/dataflow/internal/ModelExclusions.qll
// to avoid the use of internal modules.
/** Holds if the given package \`p\` is a test package. */
pragma[nomagic]
private predicate isTestPackage(Package p) {
  p.getName()
      .matches([
          "org.junit%", "junit.%", "org.mockito%", "org.assertj%",
          "com.github.tomakehurst.wiremock%", "org.hamcrest%", "org.springframework.test.%",
          "org.springframework.mock.%", "org.springframework.boot.test.%", "reactor.test%",
          "org.xmlunit%", "org.testcontainers.%", "org.opentest4j%", "org.mockserver%",
          "org.powermock%", "org.skyscreamer.jsonassert%", "org.rnorth.visibleassertions",
          "org.openqa.selenium%", "com.gargoylesoftware.htmlunit%", "org.jboss.arquillian.testng%",
          "org.testng%"
        ])
}

/**
 * A test library.
 */
class TestLibrary extends RefType {
  TestLibrary() { isTestPackage(this.getPackage()) }
}

/** Holds if the given file is a test file. */
private predicate isInTestFile(File file) {
  file.getAbsolutePath().matches(["%/test/%", "%/guava-tests/%", "%/guava-testlib/%"]) and
  not file.getAbsolutePath().matches("%/ql/test/%") // allows our test cases to work
}

/** Holds if the given compilation unit's package is a JDK internal. */
private predicate isJdkInternal(CompilationUnit cu) {
  cu.getPackage().getName().matches("org.graalvm%") or
  cu.getPackage().getName().matches("com.sun%") or
  cu.getPackage().getName().matches("sun%") or
  cu.getPackage().getName().matches("jdk%") or
  cu.getPackage().getName().matches("java2d%") or
  cu.getPackage().getName().matches("build.tools%") or
  cu.getPackage().getName().matches("propertiesparser%") or
  cu.getPackage().getName().matches("org.jcp%") or
  cu.getPackage().getName().matches("org.w3c%") or
  cu.getPackage().getName().matches("org.ietf.jgss%") or
  cu.getPackage().getName().matches("org.xml.sax%") or
  cu.getPackage().getName().matches("com.oracle%") or
  cu.getPackage().getName().matches("org.omg%") or
  cu.getPackage().getName().matches("org.relaxng%") or
  cu.getPackage().getName() = "compileproperties" or
  cu.getPackage().getName() = "transparentruler" or
  cu.getPackage().getName() = "genstubs" or
  cu.getPackage().getName() = "netscape.javascript" or
  cu.getPackage().getName() = ""
}

/** Holds if the given callable is not worth modeling. */
predicate isUninterestingForModels(Callable c) {
  isInTestFile(c.getCompilationUnit().getFile()) or
  isJdkInternal(c.getCompilationUnit()) or
  c instanceof MainMethod or
  c instanceof StaticInitializer or
  exists(FunctionalExpr funcExpr | c = funcExpr.asMethod()) or
  c.getDeclaringType() instanceof TestLibrary or
  c.(Constructor).isParameterless()
}

/**
 * A class that represents all callables for which we might be
 * interested in having a MaD model.
 */
class ModelApi extends SrcCallable {
  ModelApi() {
    this.fromSource() and
    this.isEffectivelyPublic() and
    not isUninterestingForModels(this)
  }
}
`,
  },
};
