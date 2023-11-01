import { Query } from "./query";

export const fetchExternalApisQuery: Query = {
  applicationModeQuery: `/**
 * @name Fetch endpoints for use in the model editor (application mode)
 * @description A list of 3rd party endpoints (methods and attributes) used in the codebase. Excludes test and generated code.
 * @kind table
 * @id rb/utils/modeleditor/application-mode-endpoints
 * @tags modeleditor endpoints application-mode
 */

import ruby

select "todo", "todo", "todo", "todo", "todo", false, "todo", "todo", "todo", "todo"
`,
  frameworkModeQuery: `/**
 * @name Fetch endpoints for use in the model editor (framework mode)
 * @description A list of endpoints accessible (methods and attributes) for consumers of the library. Excludes test and generated code.
 * @kind table
 * @id rb/utils/modeleditor/framework-mode-endpoints
 * @tags modeleditor endpoints framework-mode
 */

import ruby
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
    "FrameworkModeEndpointsQuery.qll": `private import ruby
private import ModelEditor
private import modeling.internal.Util as Util

/**
 * A class of effectively public callables from source code.
 */
class PublicEndpointFromSource extends Endpoint {
  PublicEndpointFromSource() {
    this.getFile() instanceof Util::RelevantFile
  }

  override predicate isSource() { this instanceof SourceCallable }

  override predicate isSink() { this instanceof SinkCallable }
}
`,
    "ModelEditor.qll": `/** Provides classes and predicates related to handling APIs for the VS Code extension. */

private import ruby
private import codeql.ruby.dataflow.FlowSummary
private import codeql.ruby.dataflow.internal.DataFlowPrivate
private import codeql.ruby.dataflow.internal.FlowSummaryImpl as FlowSummaryImpl
private import codeql.ruby.dataflow.internal.FlowSummaryImplSpecific
private import modeling.internal.Util as Util
private import modeling.internal.Types
private import codeql.ruby.frameworks.core.Gem

/** Holds if the given callable is not worth supporting. */
private predicate isUninteresting(DataFlow::MethodNode c) {
  c.getLocation().getFile().getRelativePath().regexpMatch(".*(test|spec).*")
}

/**
 * A callable method or accessor from either the Ruby Standard Library, a 3rd party library, or from the source.
 */
class Endpoint extends DataFlow::MethodNode {
  Endpoint() {
    this.isPublic() and not isUninteresting(this)
  }

  File getFile() { result = this.getLocation().getFile() }

  string getName() { result = this.getMethodName() }

  /**
   * Gets the namespace of this endpoint.
   */
  bindingset[this]
  string getNamespace() {
    // Return the name of any gemspec file in the database.
    // TODO: make this work for projects with multiple gems (and hence multiple gemspec files)
    result = any(Gem::GemSpec g).getName()
  }

  /**
   * Gets the unbound type name of this endpoint.
   */
  bindingset[this]
  string getTypeName() {
    // result = nestedName(this.getDeclaringType().getUnboundDeclaration())
    // result = any(DataFlow::ClassNode c | Types::methodReturnsType(this, c) | c).getQualifiedName()
    result = Util::getAnAccessPathPrefixWithoutSuffix(this)
  }

  /**
   * Gets the parameter types of this endpoint.
   */
  bindingset[this]
  string getParameterTypes() {
    // For now, return the names of postional parameters. We don't always have type information, so we can't return type names.
    // We don't yet handle keyword params, splat params or block params.
    // result = "(" + parameterQualifiedTypeNamesToString(this) + ")"
    result =
      "(" +
        concat(DataFlow::ParameterNode p, int i |
          p = this.asCallable().getParameter(i)
        |
          p.getName(), "," order by i
        ) + ")"
  }

  /** Holds if this API has a supported summary. */
  pragma[nomagic]
  predicate hasSummary() {
    // this instanceof SummarizedCallable
    none()
  }

  /** Holds if this API is a known source. */
  pragma[nomagic]
  abstract predicate isSource();

  /** Holds if this API is a known sink. */
  pragma[nomagic]
  abstract predicate isSink();

  /** Holds if this API is a known neutral. */
  pragma[nomagic]
  predicate isNeutral() {
    // this instanceof FlowSummaryImpl::Public::NeutralCallable
    none()
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
  result = "source"
}

/**
 * A callable where there exists a MaD sink model that applies to it.
 */
class SinkCallable extends DataFlow::CallableNode {
  SinkCallable() { sinkElement(this.asExpr().getExpr(), _, _, _) }
}

/**
 * A callable where there exists a MaD source model that applies to it.
 */
class SourceCallable extends DataFlow::CallableNode {
  SourceCallable() { sourceElement(this.asExpr().getExpr(), _, _, _) }
}`,
    "modeling/internal/Util.qll": `private import ruby

// \`SomeClass#initialize\` methods are usually called indirectly via
// \`SomeClass.new\`, so we need to account for this when generating access paths
private string getNormalizedMethodName(DataFlow::MethodNode methodNode) {
  exists(string actualMethodName | actualMethodName = methodNode.getMethodName() |
    if actualMethodName = "initialize" then result = "new" else result = actualMethodName
  )
}

private string getAccessPathSuffix(Ast::MethodBase method) {
  if method instanceof Ast::SingletonMethod or method.getName() = "initialize"
  then result = "!"
  else result = ""
}

string getAnAccessPathPrefix(DataFlow::MethodNode methodNode) {
  result =
    getAnAccessPathPrefixWithoutSuffix(methodNode) +
      getAccessPathSuffix(methodNode.asExpr().getExpr())
}

string getAnAccessPathPrefixWithoutSuffix(DataFlow::MethodNode methodNode) {
  result =
    methodNode
        .asExpr()
        .getExpr()
        .getEnclosingModule()
        .(Ast::ConstantWriteAccess)
        .getAQualifiedName()
}

class RelevantFile extends File {
  RelevantFile() { not this.getRelativePath().regexpMatch(".*/?test(case)?s?/.*") }
}

string getMethodPath(DataFlow::MethodNode methodNode) {
  result = "Method[" + getNormalizedMethodName(methodNode) + "]"
}

private string getParameterPath(DataFlow::ParameterNode paramNode) {
  exists(Ast::Parameter param, string paramSpec |
    param = paramNode.asParameter() and
    (
      paramSpec = param.getPosition().toString()
      or
      paramSpec = param.(Ast::KeywordParameter).getName() + ":"
      or
      param instanceof Ast::BlockParameter and
      paramSpec = "block"
    )
  |
    result = "Parameter[" + paramSpec + "]"
  )
}

string getMethodParameterPath(DataFlow::MethodNode methodNode, DataFlow::ParameterNode paramNode) {
  result = getMethodPath(methodNode) + "." + getParameterPath(paramNode)
}
`,
    "modeling/internal/Types.qll": `private import ruby
private import codeql.ruby.ApiGraphs
private import Util as Util

module Types {
  private module Config implements DataFlow::ConfigSig {
    predicate isSource(DataFlow::Node source) {
      // TODO: construction of type values not using a "new" call
      source.(DataFlow::CallNode).getMethodName() = "new"
    }

    predicate isSink(DataFlow::Node sink) { sink = any(DataFlow::MethodNode m).getAReturnNode() }
  }

  private import DataFlow::Global<Config>

  predicate methodReturnsType(DataFlow::MethodNode methodNode, DataFlow::ClassNode classNode) {
    // ignore cases of initializing instance of self
    not methodNode.getMethodName() = "initialize" and
    exists(DataFlow::CallNode initCall |
      flow(initCall, methodNode.getAReturnNode()) and
      classNode.getAnImmediateReference().getAMethodCall() = initCall and
      // constructed object does not have a type declared in test code
      /*
       * TODO: this may be too restrictive, e.g.
       * - if a type is declared in both production and test code
       * - if a built-in type is extended in test code
       */

      forall(Ast::ModuleBase classDecl | classDecl = classNode.getADeclaration() |
        classDecl.getLocation().getFile() instanceof Util::RelevantFile
      )
    )
  }

  // \`exprNode\` is an instance of \`classNode\`
  private predicate exprHasType(DataFlow::ExprNode exprNode, DataFlow::ClassNode classNode) {
    exists(DataFlow::MethodNode methodNode, DataFlow::CallNode callNode |
      methodReturnsType(methodNode, classNode) and
      callNode.getATarget() = methodNode
    |
      exprNode.getALocalSource() = callNode
    )
    or
    exists(DataFlow::MethodNode containingMethod |
      classNode.getInstanceMethod(containingMethod.getMethodName()) = containingMethod
    |
      exprNode.getALocalSource() = containingMethod.getSelfParameter()
    )
  }

  // extensible predicate typeModel(string type1, string type2, string path);
  // the method node in type2 constructs an instance of classNode
  private predicate typeModelReturns(string type1, string type2, string path) {
    exists(DataFlow::MethodNode methodNode, DataFlow::ClassNode classNode |
      methodNode.getLocation().getFile() instanceof Util::RelevantFile and
      methodReturnsType(methodNode, classNode)
    |
      type1 = classNode.getQualifiedName() and
      type2 = Util::getAnAccessPathPrefix(methodNode) and
      path = Util::getMethodPath(methodNode) + ".ReturnValue"
    )
  }

  predicate methodTakesParameterOfType(
    DataFlow::MethodNode methodNode, DataFlow::ClassNode classNode,
    DataFlow::ParameterNode parameterNode
  ) {
    exists(DataFlow::CallNode callToMethodNode, DataFlow::LocalSourceNode argumentNode |
      callToMethodNode.getATarget() = methodNode and
      // positional parameter
      exists(int paramIndex |
        argumentNode.flowsTo(callToMethodNode.getArgument(paramIndex)) and
        parameterNode = methodNode.getParameter(paramIndex)
      )
      or
      // keyword parameter
      exists(string kwName |
        argumentNode.flowsTo(callToMethodNode.getKeywordArgument(kwName)) and
        parameterNode = methodNode.getKeywordParameter(kwName)
      )
      or
      // block parameter
      argumentNode.flowsTo(callToMethodNode.getBlock()) and
      parameterNode = methodNode.getBlockParameter()
    |
      // parameter directly from new call
      argumentNode.(DataFlow::CallNode).getMethodName() = "new" and
      classNode.getAnImmediateReference().getAMethodCall() = argumentNode
      or
      // parameter from indirect new call
      exists(DataFlow::ExprNode argExpr |
        exprHasType(argExpr, classNode) and
        argumentNode.(DataFlow::CallNode).getATarget() = argExpr
      )
    )
  }

  private predicate typeModelParameters(string type1, string type2, string path) {
    exists(
      DataFlow::MethodNode methodNode, DataFlow::ClassNode classNode,
      DataFlow::ParameterNode parameterNode
    |
      methodNode.getLocation().getFile() instanceof Util::RelevantFile and
      methodTakesParameterOfType(methodNode, classNode, parameterNode)
    |
      type1 = classNode.getQualifiedName() and
      type2 = Util::getAnAccessPathPrefix(methodNode) and
      path = Util::getMethodParameterPath(methodNode, parameterNode)
    )
  }

  // TODO: non-positional params for block arg parameters
  private predicate methodYieldsType(
    DataFlow::CallableNode callableNode, int argIdx, DataFlow::ClassNode classNode
  ) {
    exprHasType(callableNode.getABlockCall().getArgument(argIdx), classNode)
  }

  /*
   * e.g. for
   * \`\`\`rb
   * class Foo
   *  def initialize
   *    // do some stuff...
   *    if block_given?
   *      yield self
   *    end
   *  end
   *
   *  def do_something
   *    // do something else
   *  end
   * end
   *
   * Foo.new do |foo| foo.do_something end
   * \`\`\`
   *
   * the parameter foo to the block is an instance of Foo.
   */

  private predicate typeModelBlockArgumentParameters(string type1, string type2, string path) {
    exists(DataFlow::MethodNode methodNode, DataFlow::ClassNode classNode, int argIdx |
      methodNode.getLocation().getFile() instanceof Util::RelevantFile and
      methodYieldsType(methodNode, argIdx, classNode)
    |
      type1 = classNode.getQualifiedName() and
      type2 = Util::getAnAccessPathPrefix(methodNode) and
      path = Util::getMethodPath(methodNode) + ".Argument[block].Parameter[" + argIdx + "]"
    )
  }

  predicate typeModel(string type1, string type2, string path) {
    typeModelReturns(type1, type2, path)
    or
    typeModelParameters(type1, type2, path)
    or
    typeModelBlockArgumentParameters(type1, type2, path)
  }
}
`,
  },
};
