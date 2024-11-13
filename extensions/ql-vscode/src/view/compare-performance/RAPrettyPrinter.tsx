import { Fragment } from "react";

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
        this.abbreviations.set(names[index], r.abbreviate());
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
    let args: QualifiedName[] | undefined;
    if (skipToken(">")) {
      args = [];
      while (peek() !== "<") {
        args.push(parseQName());
        skipToken(",");
      }
      args.reverse();
      skipToken("<");
    }
    const name = next();
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
  abbreviate: () => React.ReactNode;
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
      abbreviate: () => {
        const result: React.ReactNode[] = [];
        if (prefix != null) {
          result.push(prefix.abbreviate());
          result.push("::");
        }
        result.push(qname.name);
        if (args != null) {
          result.push("<");
          if (trieNodeBeforeArgs.children.size === 1) {
            result.push("...");
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

const nameTokenRegex = /\b[^ ]+::[^ (]+\b/g;

export function abbreviateRASteps(steps: string[]): React.ReactNode[] {
  const nameTokens = steps.flatMap((step) =>
    Array.from(step.matchAll(nameTokenRegex)).map((tok) => tok[0]),
  );
  const nameSet = new NameSet(nameTokens);
  return steps.map((step, index) => {
    const matches = Array.from(step.matchAll(nameTokenRegex));
    const result: React.ReactNode[] = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const before = step.slice(
        i === 0 ? 0 : matches[i - 1].index + matches[i - 1][0].length,
        match.index,
      );
      result.push(before);
      result.push(nameSet.getAbbreviation(match[0]));
    }
    result.push(
      matches.length === 0
        ? step
        : step.slice(
            matches[matches.length - 1].index +
              matches[matches.length - 1][0].length,
          ),
    );
    return <Fragment key={index}>{result}</Fragment>;
  });
}
