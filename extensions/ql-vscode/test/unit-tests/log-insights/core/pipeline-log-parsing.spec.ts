import { getDependentPredicates } from "../../../../src/log-insights/core/pipeline-log-parsing";

describe("pipeline-log-parsing", () => {
  describe("getDependentPredicates", () => {
    test("should parse unnamed RA nodes", () => {
      const ra = [
        "{1} r1 = CONSTANT(unique int)[1]",
        "{2}    | JOIN WITH foo#1 ON FIRST 1 OUTPUT Lhs.0, Rhs.1",
        "{2}    | AND NOT bar#2(FIRST 2)",
      ];
      const dependencies = ["foo#1", "bar#2"];
      expect(getDependentPredicates(ra)).toEqual(dependencies);
    });
    test("should parse n-ary RA unions", () => {
      const ra = [
        "    {1} r1 = CONSTANT(unique int)[1]",
        "",
        "    {1} r2 = foobar#42 UNION r1 UNION foo#1 UNION bar#3",
        "    return r2",
      ];
      const dependencies = ["foobar#42", "foo#1", "bar#3"];
      expect(getDependentPredicates(ra)).toEqual(dependencies);
    });
    test("should parse RA with unnamed internal nodes", () => {
      const ra = [
        "    {1} r1 = JOIN Expr::Literal#f#20226873 WITH m#Expr::Expr.isCompileTimeConstant/0#dispred#b#20226873 ON FIRST 1 OUTPUT Lhs.0",
        "    {2}    | JOIN WITH Expr::Expr.getType/0#dispred#ff#20226873 ON FIRST 1 OUTPUT Rhs.1, Lhs.0",
        "    {1}    | JOIN WITH JDK::TypeString#f#38921eae ON FIRST 1 OUTPUT Lhs.1",
        "    {1}    | AND NOT Type::PrimitiveType#f#6144c3fd(FIRST 1)",
        "    return r1",
      ];
      const dependencies = [
        "Expr::Literal#f#20226873",
        "m#Expr::Expr.isCompileTimeConstant/0#dispred#b#20226873",
        "Expr::Expr.getType/0#dispred#ff#20226873",
        "JDK::TypeString#f#38921eae",
        "Type::PrimitiveType#f#6144c3fd",
      ];
      expect(getDependentPredicates(ra)).toEqual(dependencies);
    });
    test("should parse identifiers from RA", () => {
      const ra = [
        "    {1} r1 = JOIN Expr::Literal#f#20226873 WITH m#Expr::Expr.isCompileTimeConstant/0#dispred#b#20226873 ON FIRST 1 OUTPUT Lhs.0",
        "    {2} r2 = JOIN r1 WITH Expr::Expr.getType/0#dispred#ff#20226873 ON FIRST 1 OUTPUT Rhs.1, Lhs.0",
        "",
        "    {1} r3 = JOIN r2 WITH JDK::TypeString#f#38921eae ON FIRST 1 OUTPUT Lhs.1",
        "",
        "    {1} r4 = JOIN r2 WITH Type::PrimitiveType#f#6144c3fd ON FIRST 1 OUTPUT Lhs.1",
        "",
        "    {1} r5 = r3 UNION r4",
        "    {1} r6 = foobar#42 UNION r5",
        "    return r6",
      ];
      const dependencies = [
        "Expr::Literal#f#20226873",
        "m#Expr::Expr.isCompileTimeConstant/0#dispred#b#20226873",
        "Expr::Expr.getType/0#dispred#ff#20226873",
        "JDK::TypeString#f#38921eae",
        "Type::PrimitiveType#f#6144c3fd",
        "foobar#42",
      ];
      expect(getDependentPredicates(ra)).toEqual(dependencies);
    });
    test("should parse quoted identifiers from RA", () => {
      const ra = [
        "    {1} r1 = JOIN Expr::Literal#f#20226873 WITH `m#Expr::Expr<AST>::isCompileTimeConstant/0#dispred#b#20226873` ON FIRST 1 OUTPUT Lhs.0",
        "    {2} r2 = JOIN r1 WITH `Expr::Expr.getType/0#dispred#ff#20226873` ON FIRST 1 OUTPUT Rhs.1, Lhs.0",
        "",
        "    {1} r3 = JOIN r2 WITH JDK::TypeString#f#38921eae ON FIRST 1 OUTPUT Lhs.1",
        "",
        "    {1} r4 = JOIN r2 WITH Type::PrimitiveType#f#6144c3fd ON FIRST 1 OUTPUT Lhs.1",
        "",
        "    {1} r5 = r3 UNION r4",
        "    {1} r6 = INVOKE HIGHER-ORDER RELATION construct<`Completion::MaybeLabel#9c1de908`,0> ON <`Completion::JustLabel#dom#f#9c1de908`,`Completion::JustLabel2#dom#f#9c1de908`>",
        "    {1} r7 = r6 AND NOT `this is a weird predicate identifier name`(Lhs.0)",
        "    return r6",
      ];
      const dependencies = [
        "Expr::Literal#f#20226873",
        "m#Expr::Expr<AST>::isCompileTimeConstant/0#dispred#b#20226873",
        "Expr::Expr.getType/0#dispred#ff#20226873",
        "JDK::TypeString#f#38921eae",
        "Type::PrimitiveType#f#6144c3fd",
        "Completion::JustLabel#dom#f#9c1de908",
        "Completion::JustLabel2#dom#f#9c1de908",
        "this is a weird predicate identifier name",
      ];
      expect(getDependentPredicates(ra)).toEqual(dependencies);
    });
  });
});
