import 'vscode-test';
import 'mocha';
import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import * as sarif from 'sarif';
import { extractAnalysisAlerts, tryGetRule, tryGetSeverity } from '../../src/remote-queries/sarif-processing';
import { AnalysisMessage, AnalysisMessageLocationToken } from '../../src/remote-queries/shared/analysis-result';

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
    it('should return undefined if no rule set', () => {
      const result = {
        message: 'msg'
      } as sarif.Result;

      // The rule should be set here.
      const rule: sarif.ReportingDescriptor | undefined = undefined;

      const sarifRun = {
        results: [result]
      } as sarif.Run;

      const severity = tryGetSeverity(sarifRun, result, rule);
      expect(severity).to.be.undefined;
    });

    it('should return undefined if severity not set on rule', () => {
      const result = {
        message: 'msg',
        rule: {
          id: 'A'
        }
      } as sarif.Result;

      const rule = {
        id: 'A',
        properties: {
          // Severity not set
        }
      } as sarif.ReportingDescriptor;

      const sarifRun = {
        results: [result],
        tool: {
          driver: {
            rules: [
              rule,
              result.rule
            ]
          }
        }
      } as sarif.Run;

      const severity = tryGetSeverity(sarifRun, result, rule);
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

        const rule = {
          id: 'A',
          properties: {
            'problem.severity': sarifSeverity
          }
        } as sarif.ReportingDescriptor;

        const sarifRun = {
          results: [result],
          tool: {
            driver: {
              rules: [
                rule,
                result.rule
              ]
            }
          }
        } as sarif.Run;

        const severity = tryGetSeverity(sarifRun, result, rule);
        expect(severity).to.equal(parsedSeverity);
      });
    });

  });

  describe('extractAnalysisAlerts', () => {
    it('should not return any results if no runs found in the SARIF', () => {
      const sarif = {
        // Runs are missing here.
      } as sarif.Log;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.alerts.length).to.equal(0);
    });

    it('should not return any results for runs that have no results', () => {
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
      expect(result.alerts.length).to.equal(0);
    });

    it('should return errors for results that have no message', () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.message.text = undefined;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expectResultParsingError(result.errors[0]);
    });

    it('should return errors for result locations with no context region', () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.contextRegion = undefined;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expectResultParsingError(result.errors[0]);
    });

    it('should not return errors for result locations with no region', () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.region = undefined;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.alerts.length).to.equal(1);
    });

    it('should return errors for result locations with no physical location', () => {
      const sarif = buildValidSarifLog();
      sarif.runs![0]!.results![0]!.locations![0]!.physicalLocation!.artifactLocation = undefined;

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(1);
      expectResultParsingError(result.errors[0]);
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
      expect(result.alerts.find(a => getMessageText(a.message) === 'msg1' && a.codeSnippet.text === 'foo')).to.be.ok;
      expect(result.alerts.find(a => getMessageText(a.message) === 'msg1' && a.codeSnippet.text === 'bar')).to.be.ok;
      expect(result.alerts.find(a => getMessageText(a.message) === 'msg2' && a.codeSnippet.text === 'baz')).to.be.ok;
      expect(result.alerts.every(a => a.severity === 'Warning')).to.be.true;
    });

    it('should deal with complex messages', () => {
      const sarif = buildValidSarifLog();
      const messageText = 'This shell command depends on an uncontrolled [absolute path](1).';
      sarif.runs![0]!.results![0]!.message!.text = messageText;
      sarif.runs![0]!.results![0].relatedLocations = [
        {
          id: 1,
          physicalLocation: {
            artifactLocation: {
              uri: 'npm-packages/meteor-installer/config.js',
            },
            region: {
              startLine: 35,
              startColumn: 20,
              endColumn: 60
            }
          },
        }
      ];

      const result = extractAnalysisAlerts(sarif);

      expect(result).to.be.ok;
      expect(result.errors.length).to.equal(0);
      expect(result.alerts.length).to.equal(1);
      const message = result.alerts[0].message;
      expect(message.tokens.length).to.equal(3);
      expect(message.tokens[0].t).to.equal('text');
      expect(message.tokens[0].text).to.equal('This shell command depends on an uncontrolled ');
      expect(message.tokens[1].t).to.equal('location');
      expect(message.tokens[1].text).to.equal('absolute path');
      expect((message.tokens[1] as AnalysisMessageLocationToken).location).to.deep.equal({
        filePath: 'npm-packages/meteor-installer/config.js',
        highlightedRegion: {
          startLine: 35,
          startColumn: 20,
          endLine: 35,
          endColumn: 59
        }
      });
      expect(message.tokens[2].t).to.equal('text');
      expect(message.tokens[2].text).to.equal('.');
    });
  });

  function expectResultParsingError(msg: string) {
    expect(msg.startsWith('Error when processing SARIF result')).to.be.true;
  }

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

  function getMessageText(message: AnalysisMessage) {
    return message.tokens.map(t => t.text).join('');
  }
});
