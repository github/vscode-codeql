import { Query } from "./query";

export const fetchExternalApisQuery: Query = {
  applicationModeQuery: `/**
 * @name Fetch endpoints for use in the model editor (application mode)
 * @description A list of 3rd party endpoints (methods and attributes) used in the codebase. Excludes test and generated code.
 * @kind table
 * @id rb/utils/modeleditor/application-mode-endpoints
 * @tags modeleditor endpoints application-mode
 */

import codeql.ruby.AST

// This query is empty as Application Mode is not yet supported for Ruby.
from
  Call usage, string package, string type, string name, string parameters, boolean supported,
  string namespace, string version, string supportedType, string classification
where none()
select usage, package, namespace, type, name, parameters, supported, namespace, version,
  supportedType, classification
`,
  frameworkModeQuery: `/**
 * @name Fetch endpoints for use in the model editor (framework mode)
 * @description A list of endpoints accessible (methods and attributes) for consumers of the library. Excludes test and generated code.
 * @kind table
 * @id rb/utils/modeleditor/framework-mode-endpoints
 * @tags modeleditor endpoints framework-mode
 */

import ruby
import ModelEditor

from PublicEndpointFromSource endpoint
select endpoint, endpoint.getNamespace(), endpoint.getTypeName(), endpoint.getName(),
  endpoint.getParameterTypes(), endpoint.getSupportedStatus(), endpoint.getFile().getBaseName(),
  endpoint.getSupportedType()
`,
  dependencies: {
    "ModelEditor.qll": `/** Provides classes and predicates related to handling APIs for the VS Code extension. */

private import ruby
private import codeql.ruby.dataflow.FlowSummary
private import codeql.ruby.dataflow.internal.DataFlowPrivate
private import codeql.ruby.dataflow.internal.FlowSummaryImpl as FlowSummaryImpl
private import codeql.ruby.dataflow.internal.FlowSummaryImplSpecific
private import codeql.ruby.frameworks.core.Gem
private import codeql.ruby.frameworks.data.ModelsAsData
private import codeql.ruby.frameworks.data.internal.ApiGraphModelsExtensions
private import queries.modeling.internal.Util as Util

/** Holds if the given callable is not worth supporting. */
private predicate isUninteresting(DataFlow::MethodNode c) {
  c.getLocation().getFile() instanceof TestFile
}

private predicate gemFileStep(Gem::GemSpec gem, Folder folder, int n) {
  n = 0 and folder.getAFile() = gem.(File)
  or
  exists(Folder parent, int m |
    gemFileStep(gem, parent, m) and
    parent.getAFolder() = folder and
    n = m + 1
  )
}

/**
 * A callable method or accessor from either the Ruby Standard Library, a 3rd party library, or from the source.
 */
class Endpoint extends DataFlow::MethodNode {
  Endpoint() { this.isPublic() and not isUninteresting(this) }

  File getFile() { result = this.getLocation().getFile() }

  string getName() { result = this.getMethodName() }

  /**
   * Gets the namespace of this endpoint.
   */
  bindingset[this]
  string getNamespace() {
    exists(Folder folder | folder = this.getFile().getParentContainer() |
      // The nearest gemspec to this endpoint, if one exists
      result = min(Gem::GemSpec g, int n | gemFileStep(g, folder, n) | g order by n).getName()
      or
      not gemFileStep(_, folder, _) and
      result = ""
    )
  }

  /**
   * Gets the unbound type name of this endpoint.
   */
  bindingset[this]
  string getTypeName() {
    result =
      any(DataFlow::ModuleNode m | m.getOwnInstanceMethod(this.getMethodName()) = this)
          .getQualifiedName() or
    result =
      any(DataFlow::ModuleNode m | m.getOwnSingletonMethod(this.getMethodName()) = this)
            .getQualifiedName() + "!"
  }

  /**
   * Gets the parameter types of this endpoint.
   */
  bindingset[this]
  string getParameterTypes() {
    // For now, return the names of postional and keyword parameters. We don't always have type information, so we can't return type names.
    // We don't yet handle splat params or block params.
    result =
      "(" +
        concat(string key, string value |
          value = any(int i | i.toString() = key | this.asCallable().getParameter(i)).getName()
          or
          exists(DataFlow::ParameterNode param |
            param = this.asCallable().getKeywordParameter(key)
          |
            value = key + ":"
          )
        |
          value, "," order by key
        ) + ")"
  }

  /** Holds if this API has a supported summary. */
  pragma[nomagic]
  predicate hasSummary() { none() }

  /** Holds if this API is a known source. */
  pragma[nomagic]
  abstract predicate isSource();

  /** Holds if this API is a known sink. */
  pragma[nomagic]
  abstract predicate isSink();

  /** Holds if this API is a known neutral. */
  pragma[nomagic]
  predicate isNeutral() { none() }

  /**
   * Holds if this API is supported by existing CodeQL libraries, that is, it is either a
   * recognized source, sink or neutral or it has a flow summary.
   */
  predicate isSupported() {
    this.hasSummary() or this.isSource() or this.isSink() or this.isNeutral()
  }

  boolean getSupportedStatus() { if this.isSupported() then result = true else result = false }

  string getSupportedType() {
    this.isSink() and result = "sink"
    or
    this.isSource() and result = "source"
    or
    this.hasSummary() and result = "summary"
    or
    this.isNeutral() and result = "neutral"
    or
    not this.isSupported() and result = ""
  }
}

string methodClassification(Call method) {
  method.getFile() instanceof TestFile and result = "test"
  or
  not method.getFile() instanceof TestFile and
  result = "source"
}

class TestFile extends File {
  TestFile() {
    this.getRelativePath().regexpMatch(".*(test|spec).+") and
    not this.getAbsolutePath().matches("%/ql/test/%") // allows our test cases to work
  }
}

/**
 * A callable where there exists a MaD sink model that applies to it.
 */
class SinkCallable extends DataFlow::MethodNode {
  SinkCallable() {
    exists(string type, string path, string method |
      method = path.regexpCapture("(Method\\\\[[^\\\\]]+\\\\]).*", 1) and
      Util::pathToMethod(this, type, method) and
      sinkModel(type, path, _)
    )
  }
}

/**
 * A callable where there exists a MaD source model that applies to it.
 */
class SourceCallable extends DataFlow::CallableNode {
  SourceCallable() {
    exists(string type, string path, string method |
      method = path.regexpCapture("(Method\\\\[[^\\\\]]+\\\\]).*", 1) and
      Util::pathToMethod(this, type, method) and
      sourceModel(type, path, _)
    )
  }
}

/**
 * A class of effectively public callables from source code.
 */
class PublicEndpointFromSource extends Endpoint {
  override predicate isSource() { this instanceof SourceCallable }

  override predicate isSink() { this instanceof SinkCallable }
}
`,
    "queries/modeling/internal/Util.qll": `/**
 * Contains utility methods and classes to assist with generating data extensions models.
 */

private import ruby
private import codeql.ruby.ApiGraphs

/**
 * A file that is relevant in the context of library modeling.
 *
 * In practice, this means a file that is not part of test code.
 */
class RelevantFile extends File {
  RelevantFile() { not this.getRelativePath().regexpMatch(".*/?test(case)?s?/.*") }
}

/**
 * Gets an access path of an argument corresponding to the given \`paramNode\`.
 */
string getArgumentPath(DataFlow::ParameterNode paramNode) {
  paramNode.getLocation().getFile() instanceof RelevantFile and
  exists(string paramSpecifier |
    exists(Ast::Parameter param |
      param = paramNode.asParameter() and
      (
        paramSpecifier = param.getPosition().toString()
        or
        paramSpecifier = param.(Ast::KeywordParameter).getName() + ":"
        or
        param instanceof Ast::BlockParameter and
        paramSpecifier = "block"
      )
    )
    or
    paramNode instanceof DataFlow::SelfParameterNode and paramSpecifier = "self"
  |
    result = "Argument[" + paramSpecifier + "]"
  )
}

/**
 * Holds if \`(type,path)\` evaluates to the given method, when evalauted from a client of the current library.
 */
predicate pathToMethod(DataFlow::MethodNode method, string type, string path) {
  method.getLocation().getFile() instanceof RelevantFile and
  exists(DataFlow::ModuleNode mod, string methodName |
    method = mod.getOwnInstanceMethod(methodName) and
    if methodName = "initialize"
    then (
      type = mod.getQualifiedName() + "!" and
      path = "Method[new]"
    ) else (
      type = mod.getQualifiedName() and
      path = "Method[" + methodName + "]"
    )
    or
    method = mod.getOwnSingletonMethod(methodName) and
    type = mod.getQualifiedName() + "!" and
    path = "Method[" + methodName + "]"
  )
}

/**
 * Gets any parameter to \`methodNode\`. This may be a positional, keyword,
 * block, or self parameter.
 */
DataFlow::ParameterNode getAnyParameter(DataFlow::MethodNode methodNode) {
  result =
    [
      methodNode.getParameter(_), methodNode.getKeywordParameter(_), methodNode.getBlockParameter(),
      methodNode.getSelfParameter()
    ]
}

private predicate pathToNodeBase(API::Node node, string type, string path, boolean isOutput) {
  exists(DataFlow::MethodNode method, string prevPath | pathToMethod(method, type, prevPath) |
    isOutput = true and
    node = method.getAReturnNode().backtrack() and
    path = prevPath + ".ReturnValue" and
    not method.getMethodName() = "initialize" // ignore return value of initialize method
    or
    isOutput = false and
    exists(DataFlow::ParameterNode paramNode |
      paramNode = getAnyParameter(method) and
      node = paramNode.track()
    |
      path = prevPath + "." + getArgumentPath(paramNode)
    )
  )
}

private predicate pathToNodeRec(
  API::Node node, string type, string path, boolean isOutput, int pathLength
) {
  pathLength < 8 and
  (
    pathToNodeBase(node, type, path, isOutput) and
    pathLength = 1
    or
    exists(API::Node prevNode, string prevPath, boolean prevIsOutput, int prevPathLength |
      pathToNodeRec(prevNode, type, prevPath, prevIsOutput, prevPathLength) and
      pathLength = prevPathLength + 1
    |
      node = prevNode.getAnElement() and
      path = prevPath + ".Element" and
      isOutput = prevIsOutput
      or
      node = prevNode.getReturn() and
      path = prevPath + ".ReturnValue" and
      isOutput = prevIsOutput
      or
      prevIsOutput = false and
      isOutput = true and
      (
        exists(int n |
          node = prevNode.getParameter(n) and
          path = prevPath + ".Parameter[" + n + "]"
        )
        or
        exists(string name |
          node = prevNode.getKeywordParameter(name) and
          path = prevPath + ".Parameter[" + name + ":]"
        )
        or
        node = prevNode.getBlock() and
        path = prevPath + ".Parameter[block]"
      )
    )
  )
}

/**
 * Holds if \`(type,path)\` evaluates to a value corresponding to \`node\`, when evaluated from a client of the current library.
 */
predicate pathToNode(API::Node node, string type, string path, boolean isOutput) {
  pathToNodeRec(node, type, path, isOutput, _)
}`,
  },
};
