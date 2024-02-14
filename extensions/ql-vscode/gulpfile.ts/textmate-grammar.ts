/**
 * A subset of the standard TextMate grammar that is used by our transformation
 * step. For a full JSON schema, see:
 * https://github.com/martinring/tmlanguage/blob/478ad124a21933cd4b0b65f1ee7ee18ee1f87473/tmlanguage.json
 */
export interface TextmateGrammar {
  patterns: Pattern[];
  repository?: Record<string, Pattern>;
}

/**
 * The extended TextMate grammar as used by our transformation step. This is a superset of the
 * standard TextMate grammar, and includes additional fields that are used by our transformation
 * step.
 *
 * Any comment of the form `(?#ref-id)` in a `match`, `begin`, or `end` property will be replaced
 * with the match text of the rule named "ref-id". If the rule named "ref-id" consists of just a
 * `patterns` property with a list of `include` directives, the replacement pattern is the
 * disjunction of the match patterns of all of the included rules.
 */
export interface ExtendedTextmateGrammar<MatchType = string> {
  /**
   * This represents the set of regular expression options to apply to all regular
   * expressions throughout the file.
   */
  regexOptions?: string;
  /**
   * This element defines a map of macro names to replacement text. When a `match`, `begin`, or
   * `end` property has a value that is a single-key map, the value is replaced with the value of the
   * macro named by the key, with any use of `(?#)` in the macro text replaced with the text of the
   * value of the key, surrounded by a non-capturing group (`(?:)`). For example:
   *
   * The `beginPattern` and `endPattern` Properties
   * A rule can have a `beginPattern` or `endPattern` property whose value is a reference to another
   * rule (e.g. `#other-rule`). The `beginPattern` property is replaced as follows:
   *
   * my-rule:
   *   beginPattern: '#other-rule'
   *
   * would be transformed to
   *
   * my-rule:
   *   begin: '(?#other-rule)'
   *   beginCaptures:
   *     '0':
   *       patterns:
   *       - include: '#other-rule'
   *
   * An `endPattern` property is transformed similary.
   *
   * macros:
   *   repeat: '(?#)*'
   * repository:
   *   multi-letter:
   *     match:
   *       repeat: '[A-Za-z]'
   *     name: scope.multi-letter
   *
   * would be transformed to
   *
   * repository:
   *   multi-letter:
   *     match: '(?:[A-Za-z])*'
   *     name: scope.multi-letter
   */
  macros?: Record<string, string>;

  patterns: Array<Pattern<MatchType>>;
  repository?: Record<string, Pattern<MatchType>>;
}

export interface Pattern<MatchType = string> {
  include?: string;
  match?: MatchType;
  begin?: MatchType;
  end?: MatchType;
  while?: MatchType;
  captures?: Record<string, PatternCapture>;
  beginCaptures?: Record<string, PatternCapture>;
  endCaptures?: Record<string, PatternCapture>;
  patterns?: Array<Pattern<MatchType>>;
  beginPattern?: string;
  endPattern?: string;
}

export interface PatternCapture {
  name?: string;
  patterns?: Pattern[];
}

export type ExtendedMatchType = string | Record<string, string>;
