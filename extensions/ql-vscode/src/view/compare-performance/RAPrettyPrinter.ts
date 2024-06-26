/**
 * A set of names, for generating unambiguous abbreviations.
 */
export class NameSet {
  private readonly abbreviations = new Map<string, string>();

  constructor(readonly names: string[]) {
    const qnames = names.map(parseName);
    const builder = new TrieBuilder();
    qnames
      .map((qname) => builder.visitQName(qname))
      .forEach((r, index) => {
        this.abbreviations.set(names[index], r.abbreviate());
      });
  }

  public getAbbreviation(name: string) {
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
  abbreviate: () => string;
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
        let result = "";
        if (prefix != null) {
          result += prefix.abbreviate();
          result += "::";
        }
        result += qname.name;
        if (args != null) {
          result += "<";
          if (trieNodeBeforeArgs.children.size === 1) {
            result += "...";
          } else {
            result += args.map((arg) => arg.abbreviate()).join(",");
          }
          result += ">";
        }
        return result;
      },
    };
  }
}

const nameTokenRegex = /\b[^ ]+::[^ (]+\b/g;

export function abbreviateRASteps(steps: string[]): string[] {
  const nameTokens = steps.flatMap((step) =>
    Array.from(step.matchAll(nameTokenRegex)).map((tok) => tok[0]),
  );
  const nameSet = new NameSet(nameTokens);
  return steps.map((step) =>
    step.replace(nameTokenRegex, (match) => nameSet.getAbbreviation(match)),
  );
}
