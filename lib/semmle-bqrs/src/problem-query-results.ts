import 'reflect-metadata';
import { Element } from './bqrs-results';
import { qlElement, qlString, qlTuple, qlTable } from './bqrs-custom';

export class ElementReference {
  @qlElement(0)
  element: Element;
  @qlString(1)
  text: string;
}

export class ProblemAlert {
  @qlElement(0)
  element: Element;
  @qlString(1)
  message: string;
  @qlTuple({ startColumn: 2 }, ElementReference)
  references?: ElementReference[];
}

export class ProblemQueryResults {
  @qlTable(ProblemAlert, { name: ['select', 'problems'] })
  problems: ProblemAlert[];
}
