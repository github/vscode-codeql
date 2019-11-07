import 'reflect-metadata';
import { Element } from './bqrs-results';
import { qlElement, qlString, qlTuple, qlTable } from './bqrs-custom';
import { ElementReference } from './problem-query-results';

export class PathProblemAlert {
  @qlElement(0)
  element: Element;
  @qlElement(1)
  source: Element;
  @qlElement(2)
  sink: Element;
  @qlString(3)
  message: string;
  @qlTuple({ startColumn: 4 }, ElementReference)
  references?: ElementReference[];
}

export class PathProblemEdge {
  @qlElement(0)
  predecessor: Element;
  @qlElement(1)
  successor: Element;
}

export class PathProblemNode {
  @qlElement(0)
  node: Element;
  @qlString(1)
  key: string;
  @qlString(2)
  value: string;
}

export class PathProblemQueryResults {
  @qlTable(PathProblemAlert, { name: ['select', 'problems'] })
  problems: PathProblemAlert[];
  @qlTable(PathProblemNode)
  nodes: PathProblemNode[];
  @qlTable(PathProblemEdge)
  edges: PathProblemEdge[];
}
