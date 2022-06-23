import { expect } from 'chai';
import 'mocha';

import { parseVisualizerData } from '../../src/pure/log-summary-parser';

describe('Parsing Valid Summary Text', () => {
    const validSummaryText = `
    {
      "completionTime" : "2022-06-23T14:02:42.007Z",
      "raHash" : "e77dfaa9ciimqv7gb3imoesdb11",
      "predicateName" : "query::ClassPointerType::getBaseType#dispred#f0820431#ff",
      "appearsAs" : {
        "query::ClassPointerType::getBaseType#dispred#f0820431#ff" : {
          "uboot-taint.ql" : [ 3 ]
        }
      },
      "queryCausingWork" : "uboot-taint.ql",
      "evaluationStrategy" : "COMPUTE_SIMPLE",
      "millis" : 11,
      "resultSize" : 1413,
      "dependencies" : {
        "derivedtypes_2013#join_rhs" : "0da8f1fqbiin9i0mcitjedvlbc7",
        "query::Class#class#f0820431#f" : "2e5d24rnudi1l99mvtse9u567b7",
        "derivedtypes" : "070e120iu2i3dhj6pt13oqnbi66"
      },
      "ra" : {
        "pipeline" : [
          "    {1} r1 = CONSTANT(unique int)[1]",
          "    {3} r2 = JOIN r1 WITH derivedtypes_2013#join_rhs ON FIRST 1 OUTPUT Rhs.3, Rhs.1, Rhs.2",
          "    {4} r3 = JOIN r2 WITH query::Class#class#f0820431#f ON FIRST 1 OUTPUT Lhs.1, Lhs.2, 1, Lhs.0",
          "    {2} r4 = JOIN r3 WITH derivedtypes ON FIRST 4 OUTPUT Lhs.0, Lhs.3",
          "    return r4"
        ]
      },
      "pipelineRuns" : [ {
        "raReference" : "pipeline"
      } ]
    }

    {
      "completionTime" : "2022-06-23T14:02:42.072Z",
      "raHash" : "0a0e3cicgtsru1m0cun896qhi61",
      "predicateName" : "query::DefinedMemberFunction#class#f0820431#f",
      "appearsAs" : {
        "query::DefinedMemberFunction#class#f0820431#f" : {
          "uboot-taint.ql" : [ 3 ]
        }
      },
      "queryCausingWork" : "uboot-taint.ql",
      "evaluationStrategy" : "COMPUTE_SIMPLE",
      "millis" : 20,
      "resultSize" : 8740,
      "dependencies" : {
        "fun_decls" : "e6e2e6vn02fcrrtp1ks1f75cd01",
        "fun_def" : "6bec314lcq8sm3skg9mpecscp02",
        "function_instantiation" : "8caddafufc3it9svjph9m8d43me",
        "fun_decls_10#join_rhs" : "16474d6lehg7ssk83gnv2q7r8t8"
      },
      "ra" : {
        "pipeline" : [
          "    {2} r1 = SCAN fun_decls OUTPUT In.0, In.1",
          "    {2} r2 = STREAM DEDUP r1",
          "    {1} r3 = JOIN r2 WITH fun_def ON FIRST 1 OUTPUT Lhs.1",
          "",
          "    {2} r4 = SCAN function_instantiation OUTPUT In.1, In.0",
          "    {2} r5 = JOIN r4 WITH fun_decls_10#join_rhs ON FIRST 1 OUTPUT Rhs.1, Lhs.1",
          "    {1} r6 = JOIN r5 WITH fun_def ON FIRST 1 OUTPUT Lhs.1",
          "",
          "    {1} r7 = r3 UNION r6",
          "    return r7"
        ]
      },
      "pipelineRuns" : [ {
        "raReference" : "pipeline"
      } ]
    }    
  `;
  it('should return only valid EvaluatorLogData objects', () => {
    const evaluatorLogData = parseVisualizerData(validSummaryText);
    expect (evaluatorLogData.length).to.eq(2);
    for (const item of evaluatorLogData) {
        expect(item.queryName).to.not.be.empty;
        expect(item.predicateName).to.not.be.empty;
        expect(item.timeInMillis).to.be.a('number');
        expect(item.resultSize).to.be.a('number');
    }
  });

  const invalidHeaderText = `
  {
    "summaryLogVersion" : "0.3.0",
    "codeqlVersion" : "2.9.0+202204201304plus",
    "startTime" : "2022-06-23T14:02:41.607Z"
  }
  `;

  it('should not parse a summary header object', () => {
    const evaluatorLogData = parseVisualizerData(invalidHeaderText);
    expect (evaluatorLogData.length).to.eq(0);
    for (const item of evaluatorLogData) {
      expect(item).to.be.empty;
    }
  });

  const invalidSummaryText = `
  {
    "completionTime" : "2022-06-23T14:02:42.019Z",
    "raHash" : "6bec314lcq8sm3skg9mpecscp02",
    "predicateName" : "fun_def",
    "appearsAs" : {
      "fun_def" : {
        "uboot-taint.ql" : [ 3, 21, 22, 24 ]
      }
    },
    "queryCausingWork" : "uboot-taint.ql",
    "evaluationStrategy" : "EXTENSIONAL",
    "millis" : 3,
    "resultSize" : 8857
  }  
  `;

  it('should not parse a log event missing RA or millis fields', () => {
    const evaluatorLogData = parseVisualizerData(invalidSummaryText);
    expect (evaluatorLogData.length).to.eq(0);
    for (const item of evaluatorLogData) {
      expect(item).to.be.empty;
    }
  });
});
