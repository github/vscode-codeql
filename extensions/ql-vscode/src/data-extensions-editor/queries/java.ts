import { Query } from "./query";

export const fetchExternalApisQuery: Query = {
  mainQuery: `/**
 * @name Usage of APIs coming from external libraries
 * @description A list of 3rd party APIs used in the codebase. Excludes test and generated code.
 * @tags telemetry
 * @id java/telemetry/fetch-external-apis
 */

import java
import ExternalApi

private Call aUsage(ExternalApi api) {
  result.getCallee().getSourceDeclaration() = api and
  not result.getFile() instanceof GeneratedFile
}

private boolean isSupported(ExternalApi api) {
  api.isSupported() and result = true
  or
  not api.isSupported() and result = false
}

from ExternalApi api, string apiName, boolean supported, Call usage
where
  apiName = api.getApiName() and
  supported = isSupported(api) and
  usage = aUsage(api)
select apiName, supported, usage
`,
  usagesQuery: `/**
 * @name Usage of APIs coming from external libraries
 * @description A list of 3rd party APIs used in the codebase. Excludes test and generated code.
 * @kind problem
 * @id java/telemetry/fetch-external-api-usages
 */

import java
import ExternalApi

private Call aUsage(ExternalApi api) {
  result.getCallee().getSourceDeclaration() = api and
  not result.getFile() instanceof GeneratedFile
}

from ExternalApi api, string apiName, Call usage
where
  apiName = api.getApiName() and
  usage = aUsage(api)
select usage, apiName
`,
  dependencies: {
    "ExternalApi.qll": `/** Provides classes and predicates related to handling APIs from external libraries. */

private import java
private import semmle.code.java.dataflow.DataFlow
private import semmle.code.java.dataflow.ExternalFlow
private import semmle.code.java.dataflow.FlowSources
private import semmle.code.java.dataflow.FlowSummary
private import semmle.code.java.dataflow.internal.DataFlowPrivate
private import semmle.code.java.dataflow.internal.FlowSummaryImpl as FlowSummaryImpl
private import semmle.code.java.dataflow.TaintTracking

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
private class TestLibrary extends RefType {
  TestLibrary() { isTestPackage(this.getPackage()) }
}

private string containerAsJar(Container container) {
  if container instanceof JarFile then result = container.getBaseName() else result = "rt.jar"
}

/** Holds if the given callable is not worth supporting. */
private predicate isUninteresting(Callable c) {
  c.getDeclaringType() instanceof TestLibrary or
  c.(Constructor).isParameterless()
}

/**
 * An external API from either the Standard Library or a 3rd party library.
 */
class ExternalApi extends Callable {
  ExternalApi() { not this.fromSource() and not isUninteresting(this) }

  /**
   * Gets information about the external API in the form expected by the MaD modeling framework.
   */
  string getApiName() {
    result =
      this.getDeclaringType().getPackage() + "." + this.getDeclaringType().getSourceDeclaration() +
        "#" + this.getName() + paramsString(this)
  }

  /**
   * Gets the jar file containing this API. Normalizes the Java Runtime to "rt.jar" despite the presence of modules.
   */
  string jarContainer() { result = containerAsJar(this.getCompilationUnit().getParentContainer*()) }

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

/** DEPRECATED: Alias for ExternalApi */
deprecated class ExternalAPI = ExternalApi;

/**
 * Gets the limit for the number of results produced by a telemetry query.
 */
int resultLimit() { result = 1000 }

/**
 * Holds if it is relevant to count usages of \`api\`.
 */
signature predicate relevantApi(ExternalApi api);

/**
 * Given a predicate to count relevant API usages, this module provides a predicate
 * for restricting the number or returned results based on a certain limit.
 */
module Results<relevantApi/1 getRelevantUsages> {
  private int getUsages(string apiName) {
    result =
      strictcount(Call c, ExternalApi api |
        c.getCallee().getSourceDeclaration() = api and
        not c.getFile() instanceof GeneratedFile and
        apiName = api.getApiName() and
        getRelevantUsages(api)
      )
  }

  private int getOrder(string apiInfo) {
    apiInfo =
      rank[result](string info, int usages |
        usages = getUsages(info)
      |
        info order by usages desc, info
      )
  }

  /**
   * Holds if there exists an API with \`apiName\` that is being used \`usages\` times
   * and if it is in the top results (guarded by resultLimit).
   */
  predicate restrict(string apiName, int usages) {
    usages = getUsages(apiName) and
    getOrder(apiName) <= resultLimit()
  }
}
`,
  },
};
