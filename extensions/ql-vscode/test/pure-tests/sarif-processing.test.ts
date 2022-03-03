import 'vscode-test';
import 'mocha';
import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import * as sarif from 'sarif';
import { extractAnalysisAlerts, tryGetRule, tryGetSeverity } from '../../src/remote-queries/sarif-processing';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('SARIF processing', () => {
  describe('tryGetRule', () => {
    describe('Using the tool driver', () => {
      it('should return undefined if no rule has been set on the result', () => {
        const result = {
          message: 'msg'
          // Rule is missing here.
        } as sarif.Result;

        const sarifRun = {
          results: [result]
        } as sarif.Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).to.be.undefined;
      });

      it('should return undefined if rule missing from tool driver', () => {
        const result = {
          message: 'msg',
          rule: {
            id: 'NonExistentRule'
          }
        } as sarif.Result;

        const sarifRun = {
          results: [result],
          tool: {
            driver: {
              rules: [
                // No rule with id 'NonExistentRule' is set here.
                {
                  id: 'A',
                },
                {
                  id: 'B'
                }
              ]
            }
          }
        } as sarif.Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).to.be.undefined;
      });

      it('should return rule if it has been set on the tool driver', () => {
        const result = {
          message: 'msg',
          rule: {
            id: 'B'
          }
        } as sarif.Result;

        const sarifRun = {
          results: [result],
          tool: {
            driver: {
              rules: [
                {
                  id: 'A',
                },
                result.rule
              ]
            }
          }
        } as sarif.Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).to.be.ok;
        expect(rule!.id).to.equal(result!.rule!.id);
      });
    });

    describe('Using the tool extensions', () => {
      it('should return undefined if rule index not set', () => {
        const result = {
          message: 'msg',
          rule: {
            // The rule index should be set here.
            toolComponent: {
              index: 1
            }
          }
        } as sarif.Result;

        const sarifRun = {
          results: [result],
          tool: {
            extensions: [
              {
                name: 'foo',
                rules: [
                  {
                    id: 'A',
                  },
                  {
                    id: 'B'
                  }
                ]
              },
              {
                name: 'bar',
                rules: [
                  {
                    id: 'C',
                  },
                  {
                    id: 'D'
                  }
                ]
              }
            ]
          }
        } as sarif.Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).to.be.undefined;
      });

      it('should return undefined if tool component index not set', () => {
        const result = {
          message: 'msg',
          rule: {
            index: 1,
            toolComponent: {
              // The tool component index should be set here.
            }
          }
        } as sarif.Result;

        const sarifRun = {
          results: [result],
          tool: {
            extensions: [
              {
                name: 'foo',
                rules: [
                  {
                    id: 'A',
                  },
                  {
                    id: 'B'
                  }
                ]
              },
              {
                name: 'bar',
                rules: [
                  {
                    id: 'C',
                  },
                  {
                    id: 'D'
                  }
                ]
              }
            ]
          }
        } as sarif.Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).to.be.undefined;
      });

      it('should return undefined if tool extensions not set', () => {
        const result = {
          message: 'msg',
          rule: {
            index: 1,
            toolComponent: {
              index: 1
            }
          }
        } as sarif.Result;

        const sarifRun = {
          results: [result],
          tool: {
            // Extensions should be set here.
          }
        } as sarif.Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).to.be.undefined;
      });

      it('should return undefined if tool extensions do not contain index', () => {
        const result = {
          message: 'msg',
          rule: {
            index: 1,
            toolComponent: {
              index: 1
            }
          }
        } as sarif.Result;

        const sarifRun = {
          results: [result],
          tool: {
            extensions: [
              {
                name: 'foo',
                rules: [
                  {
                    id: 'A',
                  },
                  {
                    id: 'B'
                  }
                ]
              }
              // There should be one more extension here (index 1).
            ]
          }
        } as sarif.Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).to.be.undefined;
      });

      it('should return rule if all information is defined', () => {
        const result = {
          message: 'msg',
          ruleIndex: 1,
          rule: {
            index: 1,
            toolComponent: {
              index: 1
            }
          }
        } as sarif.Result;

        const sarifRun = {
          results: [result],
          tool: {
            extensions: [
              {
                name: 'foo',
                rules: [
                  {
                    id: 'A',
                  },
                  {
                    id: 'B'
                  }
                ]
              },
              {
                name: 'bar',
                rules: [
                  {
                    id: 'C',
                  },
                  {
                    id: 'D',
                  }
                ]
              }
            ]
          }
        } as sarif.Run;

        const rule = tryGetRule(sarifRun, result);

        expect(rule).to.be.ok;
        expect(rule!.id).to.equal('D');
      });
    });
  });

  describe('tryGetSeverity', () => {
    it('should return undefined if no rule found', () => {
      const result = {
        // The rule is missing here.
        message: 'msg'
      } as sarif.Result;

      const sarifRun = {
        results: [result]
      } as sarif.Run;

      const severity = tryGetSeverity(sarifRun, result);
      expect(severity).to.be.undefined;
    });

    it('should return undefined if severity not set on rule', () => {
      const result = {
        message: 'msg',
        rule: {
          id: 'A'
        }
      } as sarif.Result;

      const sarifRun = {
        results: [result],
        tool: {
          driver: {
            rules: [
              {
                id: 'A',
                properties: {
                  // Severity not set
                }
              },
              result.rule
            ]
          }
        }
      } as sarif.Run;

      const severity = tryGetSeverity(sarifRun, result);
      expect(severity).to.be.undefined;
    });

    const severityMap = {
      recommendation: 'Recommendation',
      warning: 'Warning',
      error: 'Error'
    };

    Object.entries(severityMap).forEach(([sarifSeverity, parsedSeverity]) => {
      it(`should get ${parsedSeverity} severity`, () => {
        const result = {
          message: 'msg',
          rule: {
            id: 'A'
          }
        } as sarif.Result;

        const sarifRun = {
          results: [result],
          tool: {
            driver: {
              rules: [
                {
                  id: 'A',
                  properties: {
                    'problem.severity': sarifSeverity
                  }
                },
                result.rule
              ]
            }
          }
        } as sarif.Run;

        const severity = tryGetSeverity(sarifRun, result);
        expect(severity).to.equal(parsedSeverity);
      });
    });

  });

  describe('extractAnalysisAlerts', () => {
    it('should return an error if no runs found in the SARIF', () => {
      const sarif = {
        // Runs are missing here.
      } as sarif.Log;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.equal('No runs found in the SARIF file');
    });

    it('should return errors for runs that have no results', () => {
      const sarif = {
        runs: [
          {
            results: []
          },
          {
            // Results are missing here.
          }
        ]
      } as sarif.Log;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.equal('No results found in the SARIF run');
    });

    it('should return errors for results that have no message', () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.message.text = undefined;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.equal('No message found in the SARIF result');
    });

    it('should return errors for result locations with no context region', () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.contextRegion = undefined;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.equal('No context region found in the SARIF result location');
    });

    it('should return errors for result locations with no region', () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.region = undefined;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.equal('No region found in the SARIF result location');
    });

    it('should return errors for result locations with no physical location', () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.artifactLocation = undefined;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.equal('No file path found in the SARIF result location');
    });

    it('should return results for all alerts', () => {
      const sarif = {
        version: '0.0.1' as sarif.Log.version,
        runs: [
          {
            results: [
              {
                message: {
                  text: 'msg1'
                },
                locations: [
                  {
                    physicalLocation: {
                      contextRegion: {
                        startLine: 10,
                        endLine: 12,
                        snippet: {
                          text: 'foo'
                        }
                      },
                      region: {
                        startLine: 10,
                        startColumn: 1,
                        endColumn: 3
                      },
                      artifactLocation: {
                        uri: 'foo.js'
                      }
                    }
                  },
                  {
                    physicalLocation: {
                      contextRegion: {
                        startLine: 10,
                        endLine: 12,
                        snippet: {
                          text: 'bar'
                        }
                      },
                      region: {
                        startLine: 10,
                        startColumn: 1,
                        endColumn: 3
                      },
                      artifactLocation: {
                        uri: 'bar.js'
                      }
                    }
                  }
                ]
              },
              {
                message: {
                  text: 'msg2'
                },
                locations: [
                  {
                    physicalLocation: {
                      contextRegion: {
                        startLine: 10,
                        endLine: 12,
                        snippet: {
                          text: 'baz'
                        }
                      },
                      region: {
                        startLine: 10,
                        startColumn: 1,
                        endColumn: 3
                      },
                      artifactLocation: {
                        uri: 'baz.js'
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      } as sarif.Log;

      const result = extractAnalysisAlerts(sarif);
      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(0);
      expect(result.alerts.length).to.equal(3);
      expect(result.alerts.find(a => a.message === 'msg1' && a.codeSnippet.text === 'foo')).to.be.ok;
      expect(result.alerts.find(a => a.message === 'msg1' && a.codeSnippet.text === 'bar')).to.be.ok;
      expect(result.alerts.find(a => a.message === 'msg2' && a.codeSnippet.text === 'baz')).to.be.ok;
      expect(result.alerts.every(a => a.severity === 'Warning')).to.be.true;
    });

  });

  function buildValidSarifLog(): sarif.Log {
    return {
      version: '0.0.1' as sarif.Log.version,
      runs: [
        {
          results: [
            {
              message: {
                text: 'msg'
              },
              locations: [
                {
                  physicalLocation: {
                    contextRegion: {
                      startLine: 10,
                      endLine: 12,
                      snippet: {
                        text: 'Foo'
                      }
                    },
                    region: {
                      startLine: 10,
                      startColumn: 1,
                      endColumn: 3
                    },
                    artifactLocation: {
                      uri: 'foo.js'
                    }
                  }
                }
              ]
            }
          ]
        }
      ]
    } as sarif.Log;
  }
});
