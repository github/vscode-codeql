import { Fragment, useState } from "react";
import { styled } from "styled-components";

/**
 * A set of names, for generating unambiguous abbreviations.
 */
class NameSet {
  private readonly abbreviations = new Map<string, React.ReactNode>();

  constructor(readonly names: string[]) {
    const qnames = names.map(parseName);
    const builder = new TrieBuilder();
    qnames
      .map((qname) => builder.visitQName(qname))
      .forEach((r, index) => {
        this.abbreviations.set(names[index], r.abbreviate(true));
      });
  }

  public getAbbreviation(name: string): React.ReactNode {
    return this.abbreviations.get(name) ?? name;
  }
}

/** Name parsed into the form `prefix::name<args>` */
interface QualifiedName {
  prefix?: QualifiedName;
  name: string;
  args?: QualifiedName[];
}

function qnameToString(name: QualifiedName): string {
  const parts: string[] = [];
  if (name.prefix != null) {
    parts.push(qnameToString(name.prefix));
    parts.push("::");
  }
  parts.push(name.name);
  if (name.args != null && name.args.length > 0) {
    parts.push("<");
    parts.push(name.args.map(qnameToString).join(","));
    parts.push(">");
  }
  return parts.join("");
}

function tokeniseName(text: string) {
  return Array.from(text.matchAll(/:+|<|>|,|"[^"]+"|`[^`]+`|[^:<>,"`]+/g));
}

function parseName(text: string): QualifiedName {
  const tokens = tokeniseName(text);

  function next() {
    return tokens.pop()![0];
  }
  function peek() {
    return tokens[tokens.length - 1][0];
  }
  function skipToken(token: string) {
    if (tokens.length > 0 && peek() === token) {
      tokens.pop();
      return true;
    } else {
      return false;
    }
  }

  function parseQName(): QualifiedName {
    // Note that the tokens stream is parsed in reverse order. This is simpler, but may look confusing initially.
    let args: QualifiedName[] | undefined;
    if (skipToken(">")) {
      args = [];
      while (tokens.length > 0 && peek() !== "<") {
        args.push(parseQName());
        skipToken(",");
      }
      args.reverse();
      skipToken("<");
    }
    const name = tokens.length === 0 ? "" : next();
    const prefix = skipToken("::") ? parseQName() : undefined;
    return {
      prefix,
      name,
      args,
    };
  }

  const result = parseQName();
  if (tokens.length > 0) {
    // It's a parse error if we did not consume all tokens.
    // Just treat the whole text as the 'name'.
    return { prefix: undefined, name: text, args: undefined };
  }
  return result;
}

class TrieNode {
  children = new Map<string, TrieNode>();
  constructor(readonly index: number) {}
}

interface VisitResult {
  node: TrieNode;
  abbreviate: (isRoot?: boolean) => React.ReactNode;
}

class TrieBuilder {
  root = new TrieNode(0);
  nextId = 1;

  getOrCreate(trieNode: TrieNode, child: string) {
    const { children } = trieNode;
    let node = children.get(child);
    if (node == null) {
      node = new TrieNode(this.nextId++);
      children.set(child, node);
    }
    return node;
  }

  visitQName(qname: QualifiedName): VisitResult {
    const prefix =
      qname.prefix != null ? this.visitQName(qname.prefix) : undefined;
    const trieNodeBeforeArgs = this.getOrCreate(
      prefix?.node ?? this.root,
      qname.name,
    );
    let trieNode = trieNodeBeforeArgs;
    const args = qname.args?.map((arg) => this.visitQName(arg));
    if (args != null) {
      const argKey = args.map((arg) => arg.node.index).join(",");
      trieNode = this.getOrCreate(trieNodeBeforeArgs, argKey);
    }
    return {
      node: trieNode,
      abbreviate: (isRoot = false) => {
        const result: React.ReactNode[] = [];
        if (prefix != null) {
          result.push(prefix.abbreviate());
          result.push("::");
        }
        const { name } = qname;
        const hash = name.indexOf("#");
        if (hash !== -1 && isRoot) {
          const shortName = name.substring(0, hash);
          result.push(<IdentifierSpan>{shortName}</IdentifierSpan>);
          result.push(name.substring(hash));
        } else {
          result.push(isRoot ? <IdentifierSpan>{name}</IdentifierSpan> : name);
        }
        if (args != null) {
          result.push("<");
          if (trieNodeBeforeArgs.children.size === 1) {
            const argsText = qname
              .args!.map((arg) => qnameToString(arg))
              .join(",");
            result.push(<ExpandableNamePart>{argsText}</ExpandableNamePart>);
          } else {
            let first = true;
            for (const arg of args) {
              result.push(arg.abbreviate());
              if (first) {
                first = false;
              } else {
                result.push(",");
              }
            }
          }
          result.push(">");
        }
        return result;
      },
    };
  }
}

const ExpandableTextButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: inherit;
  &:hover {
    background-color: rgba(128, 128, 128, 0.2);
  }
`;

interface ExpandableNamePartProps {
  children: React.ReactNode;
}

function ExpandableNamePart(props: ExpandableNamePartProps) {
  const [isExpanded, setExpanded] = useState(false);
  return (
    <ExpandableTextButton
      onClick={(event: Event) => {
        setExpanded(!isExpanded);
        event.stopPropagation();
      }}
    >
      {isExpanded ? props.children : "..."}
    </ExpandableTextButton>
  );
}

/**
 * Span enclosing an entire qualified name.
 *
 * Can be used to gray out uninteresting parts of the name, though this looks worse than expected.
 */
const QNameSpan = styled.span`
  /* color: var(--vscode-disabledForeground); */
`;

/** Span enclosing the innermost identifier, e.g. the `foo` in `A::B<X>::foo#abc` */
const IdentifierSpan = styled.span`
  font-weight: 600;
`;

/** Span enclosing keywords such as `JOIN` and `WITH`. */
const KeywordSpan = styled.span`
  font-weight: 500;
`;

const nameTokenRegex = /\b[^ (]+\b/g;

function traverseMatches(
  text: string,
  regex: RegExp,
  callbacks: {
    onMatch: (match: RegExpMatchArray) => void;
    onText: (text: string) => void;
  },
) {
  const matches = Array.from(text.matchAll(regex));
  let lastIndex = 0;
  for (const match of matches) {
    const before = text.substring(lastIndex, match.index);
    if (before !== "") {
      callbacks.onText(before);
    }
    callbacks.onMatch(match);
    lastIndex = match.index + match[0].length;
  }
  const after = text.substring(lastIndex);
  if (after !== "") {
    callbacks.onText(after);
  }
}

export function abbreviateRASteps(steps: string[]): React.ReactNode[] {
  const nameTokens = steps.flatMap((step) =>
    Array.from(step.matchAll(nameTokenRegex)).map((tok) => tok[0]),
  );
  const nameSet = new NameSet(nameTokens.filter((name) => name.includes("::")));
  return steps.map((step, index) => {
    const result: React.ReactNode[] = [];
    traverseMatches(step, nameTokenRegex, {
      onMatch(match) {
        const text = match[0];
        if (text.includes("::")) {
          result.push(<QNameSpan>{nameSet.getAbbreviation(text)}</QNameSpan>);
        } else if (/[A-Z]+/.test(text)) {
          result.push(<KeywordSpan>{text}</KeywordSpan>);
        } else {
          result.push(match[0]);
        }
      },
      onText(text) {
        result.push(text);
      },
    });
    return <Fragment key={index}>{result}</Fragment>;
  });
}

export function abbreviateRANames(names: string[]): React.ReactNode[] {
  const nameSet = new NameSet(names);
  return names.map((name) => nameSet.getAbbreviation(name));
}
