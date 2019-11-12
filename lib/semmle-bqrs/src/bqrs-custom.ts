import { ResultSetSchema, LocationStyle, ColumnTypeKind } from "./bqrs-schema";
import { ResultSetsReader, ResultSetReader } from "./bqrs-file";
import { ElementBase, ColumnValue } from "./bqrs-results";

/**
 * Represents a binding to all remaining columns, starting at the column index specified by
 * `startColumn`.
 */
export interface RestColumnIndex {
  startColumn: number
}

/**
 * Indentifies the result column to which a property is bound. May be the index of a specific
 * column, or an instance of `RestColumnIndex` to bind to all remaining columns.
 */
export type ColumnIndex = number | RestColumnIndex;

/**
 * Options that can be specified for a `@qlTable` attribute.
 */
export interface TableOptions {
  /**
   * The name of the table to bind to. If multiple values are specified, the property is bound to
   * the the table whose name is earliest in the list.
   */
  name?: string | string[];
}

export enum QLOption {
  Required = 'required',
  Optional = 'optional',
  Forbidden = 'forbidden'
}

/**
 * Options that can be specified for a `@qlElement` attribute.
 */
export interface ElementOptions {
  label?: QLOption;
  location?: QLOption;
}

/**
 * An attribute that binds the target property to a result column representing a QL element.
 * @param index Index of the column to be bound.
 * @param options Binding options.
 */
export function qlElement(index: ColumnIndex, options: ElementOptions = {}): PropertyDecorator {
  return (proto: any, key: PropertyKey): void => {
    column(proto, {
      key: key,
      index: index,
      type: 'e',
      options: {
        label: options.label ? options.label : QLOption.Required,
        location: options.location ? options.location : QLOption.Required
      }
    });
  }
}

/**
 * An attribute that binds the target property to a result column containing a QL string.
 * @param index Index of the column to be bound.
 */
export function qlString(index: ColumnIndex): PropertyDecorator {
  return (proto: any, key: PropertyKey): void => {
    column(proto, {
      key: key,
      index: index,
      type: 's'
    });
  }
}

/**
 * An attribute that binds the target property to a set of result columns. The individual
 * columns are bound to properties of the underlying type of the target property.
 * @param index Index of the first column to be bound.
 * @param type The type of the property.
 */
export function qlTuple(index: ColumnIndex, type: { new(): any }): PropertyDecorator {
  return (proto: any, key: PropertyKey): void => {
    column(proto, {
      key: key,
      index: index,
      type: type
    });
  }
}

type PropertyKey = string | symbol;

interface ColumnProperty {
  key: PropertyKey;
  index: ColumnIndex;
  type: ColumnTypeKind | { new(): any };
}

interface ElementProperty extends ColumnProperty {
  type: 'e';
  options: Required<ElementOptions>;
}

function isElement(property: ColumnProperty): property is ElementProperty {
  return property.type === 'e';
}

const columnPropertiesSymbol = Symbol('columnProperties');

type PropertyDecorator = (proto: any, key: PropertyKey) => void;

function column<T extends ColumnProperty>(proto: any, property: T): void {
  let columnProperties: ColumnProperty[] | undefined = Reflect.getMetadata(columnPropertiesSymbol, proto);
  if (columnProperties === undefined) {
    columnProperties = [];
    Reflect.defineMetadata(columnPropertiesSymbol, columnProperties, proto);
  }
  columnProperties.push(property);
}

interface TableProperty {
  key: PropertyKey;
  tableNames: string[];
  rowType: any;
}

const tablePropertiesSymbol = Symbol('tableProperties');

/**
 * An attribute that binds the target property to the contents of a result table.
 * @param rowType The type representing a single row in the bound table. The type of the target
 *   property must be an array of this type.
 * @param options Binding options.
 */
export function qlTable(rowType: any, options?: TableOptions): any {
  return (proto, key: PropertyKey) => {
    const realOptions = options || {};
    let names: string[];
    if (realOptions.name === undefined) {
      names = [key.toString()]
    }
    else if (typeof realOptions.name === 'string') {
      names = [realOptions.name];
    }
    else {
      names = realOptions.name;
    }

    let tableProperties: TableProperty[] | undefined = Reflect.getMetadata(tablePropertiesSymbol, proto);
    if (tableProperties === undefined) {
      tableProperties = [];
      Reflect.defineMetadata(tablePropertiesSymbol, tableProperties, proto);
    }
    tableProperties.push({
      key: key,
      tableNames: names,
      rowType: rowType
    });
  };
}

type ParseTupleAction = (src: readonly ColumnValue[], dest: any) => void;

type TupleParser<T> = (src: readonly ColumnValue[]) => T;

export class CustomResultSet<TTuple> {
  public constructor(private reader: ResultSetReader, private readonly type: { new(): TTuple },
    private readonly tupleParser: TupleParser<TTuple>) {
  }

  public async* readTuples(): AsyncIterableIterator<TTuple> {
    for await (const tuple of this.reader.readTuples()) {
      yield this.tupleParser(tuple);
    }
  }
}

class CustomResultSetBinder {
  private readonly boundColumns: boolean[];

  private constructor(private readonly rowType: { new(): any },
    private readonly schema: ResultSetSchema) {

    this.boundColumns = Array(schema.columns.length).fill(false);
  }

  public static bind<TTuple>(reader: ResultSetReader, rowType: { new(): TTuple }):
    CustomResultSet<TTuple> {

    const binder = new CustomResultSetBinder(rowType, reader.schema);
    const tupleParser = binder.bindRoot<TTuple>();

    return new CustomResultSet<TTuple>(reader, rowType, tupleParser);
  }

  private bindRoot<TTuple>(): TupleParser<TTuple> {
    const { action } = this.bindObject(this.rowType, 0, true);
    const unboundColumnIndex = this.boundColumns.indexOf(false);
    if (unboundColumnIndex >= 0) {
      throw new Error(`Column '${this.schema.name}[${unboundColumnIndex}]' is not bound to a property.`);
    }

    return tuple => {
      let result = new this.rowType;
      action(tuple, result);
      return result;
    }
  }

  private checkElementProperty(index: ColumnIndex, propertyName: 'location' | 'label',
    hasProperty: boolean, expectsProperty: QLOption): void {

    switch (expectsProperty) {
      case QLOption.Required:
        if (!hasProperty) {
          throw new Error(`Element column '${this.schema.name}[${index}]' does not have the required '${propertyName}' property.`);
        }
        break;

      case QLOption.Forbidden:
        if (!hasProperty) {
          throw new Error(`Element column '${this.schema.name}[${index}]' has unexpected '${propertyName}' property.`);
        }
        break;

      case QLOption.Optional:
        break;
    }
  }

  private bindObject(type: { new(): any }, startIndex: number, isRoot: boolean): {
    action: ParseTupleAction,
    lastColumn: number
  } {

    const columnProperties: ColumnProperty[] | undefined =
      Reflect.getMetadata(columnPropertiesSymbol, type.prototype);
    if (columnProperties === undefined) {
      throw new Error(`Type '${type.toString()}' does not have any properties decorated with '@column'.`);
    }

    const actions: ParseTupleAction[] = [];
    let restProperty: ColumnProperty | undefined = undefined;

    let lastColumn = startIndex;
    for (const property of columnProperties) {
      if (typeof property.index === 'object') {
        if (!isRoot) {
          throw new Error(`Type '${type.toString()}' has a property bound to '...', but is not the root type.`);
        }
        if (restProperty !== undefined) {
          throw new Error(`Type '${type.toString()}' has multiple properties bound to '...'.`);
        }
        restProperty = property;
      }
      else {
        const index = property.index + startIndex;
        const { action, lastColumn: lastChildColumn } = this.bindColumn(index, type, property,
          property.key);
        actions.push(action);
        lastColumn = Math.max(lastColumn, lastChildColumn);
      }
    }

    if (restProperty !== undefined) {
      const startIndex = (<RestColumnIndex>restProperty.index).startColumn;
      let index = startIndex;
      let elementIndex = 0;
      const elementActions: ParseTupleAction[] = [];
      while (index < this.schema.columns.length) {
        const { action, lastColumn: lastChildColumn } = this.bindColumn(index, type, restProperty, elementIndex);
        elementActions.push(action);
        index = lastChildColumn + 1;
        elementIndex++;
      }

      const key = restProperty.key;
      actions.push((src, dest) => {
        const destArray = Array(elementActions.length);
        elementActions.forEach(action => action(src, destArray));
        dest[key] = destArray;
      });
    }

    return {
      action: (src, dest) => actions.forEach(action => action(src, dest)),
      lastColumn: lastColumn
    };
  }

  private bindColumn(index: number, type: new () => any, property: ColumnProperty,
    key: PropertyKey | number): {
      action: ParseTupleAction,
      lastColumn: number
    } {

    if ((index < 0) || (index >= this.schema.columns.length)) {
      throw new Error(`No matching column '${index}' found for property '${type.toString()}.${property.key.toString()}' when binding root type '${this.rowType.toString()}'.`);
    }
    if (typeof property.type === 'string') {
      // This property is bound to a single column
      return {
        action: this.bindSingleColumn(index, property, type, key),
        lastColumn: index
      };
    }
    else {
      // This property is a tuple that has properties that are bound to columns.
      const propertyType = property.type;
      const { action: objectParser, lastColumn: lastChildColumn } = this.bindObject(propertyType, index, false);
      return {
        action: (src, dest) => {
          const destObject = new propertyType;
          objectParser(src, destObject);
          dest[key] = destObject;
        },
        lastColumn: lastChildColumn
      };
    }
  }

  private bindSingleColumn(index: number, property: ColumnProperty, type: new () => any,
    key: PropertyKey | number): ParseTupleAction {

    if (this.boundColumns[index]) {
      throw new Error(`Column '${this.schema.name}[${index}]' is bound to multiple columns in root type '${this.rowType.toString()}'.`);
    }
    const column = this.schema.columns[index];
    if (column.type.type !== property.type) {
      throw new Error(`Column '${this.schema.name}[${index}]' has type '${column.type.type}', but property '${type.toString()}.${property.key.toString()}' expected type '${property.type}'.`);
    }
    this.boundColumns[index] = true;

    if (isElement(property) && (column.type.type === 'e')) {
      const hasLabel = column.type.hasLabel;
      this.checkElementProperty(index, 'label', hasLabel, property.options.label);
      const hasLocation = column.type.locationStyle !== LocationStyle.None;
      this.checkElementProperty(index, 'location', hasLocation, property.options.location);
      return (src, dest) => {
        const srcElement = <ElementBase>src[index];
        const destElement: ElementBase = {
          id: srcElement.id
        };
        if (hasLabel) {
          destElement.label = srcElement.label;
        }
        if (hasLocation) {
          destElement.location = srcElement.location;
        }
        dest[key] = destElement;
      };
    }
    else {
      return (src, dest) => {
        dest[key] = src[index];
      };
    }
  }
}

type ArrayElementType<T> = T extends Array<infer U> ? U : never;

export type CustomResultSets<T> = {
  [P in keyof T]: CustomResultSet<ArrayElementType<T[P]>>;
}

export function createCustomResultSets<T>(reader: ResultSetsReader, type: { new(): T }):
  CustomResultSets<T> {

  const tableProperties: TableProperty[] | undefined = Reflect.getMetadata(tablePropertiesSymbol, type.prototype);
  if (tableProperties === undefined) {
    throw new Error(`Type '${type.toString()}' does not have any properties decorated with '@table'.`);
  }

  const customResultSets: Partial<CustomResultSets<T>> = {};

  const boundProperties = new Set<PropertyKey>();

  for (const resultSet of reader.resultSets) {
    const tableProperty = findPropertyForTable(resultSet.schema, tableProperties);
    if (tableProperty === undefined) {
      throw new Error(`No matching property found for result set '${resultSet.schema.name}'.`);
    }
    if (boundProperties.has(tableProperty.key)) {
      throw new Error(`Multiple result sets bound to property '${tableProperty.key.toString()}'.`);
    }
    boundProperties.add(tableProperty.key);
    customResultSets[tableProperty.key] = CustomResultSetBinder.bind(resultSet,
      tableProperty.rowType);
  }
  for (const tableProperty of tableProperties) {
    if (!boundProperties.has(tableProperty.key)) {
      throw new Error(`No matching table found for property '${tableProperty.key.toString()}'.`);
    }
  }

  return <CustomResultSets<T>>customResultSets;
}

function findPropertyForTable(resultSet: ResultSetSchema, tableProperties: TableProperty[]):
  TableProperty | undefined {

  const tableName = resultSet.name === '#select' ? 'select' : resultSet.name;
  return tableProperties.find(tableProperty => tableProperty.tableNames.find(name => name === tableName));
}
