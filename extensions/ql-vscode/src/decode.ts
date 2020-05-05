import { DecodedBqrsChunk, ResultSetSchema, ColumnKind, Column, ColumnValue } from "./bqrs-cli-types";
import { LocationValue, ResultSetSchema as AdaptedSchema, ColumnSchema, ColumnType, LocationStyle } from 'semmle-bqrs';

export type ResultRow = ResultValue[];

export interface ResultElement {
  label: string;
  location?: LocationValue;
}

export interface ResultUri {
  uri: string;
}

export type ResultValue = ResultElement | ResultUri | string;

export interface RawResultSet {
  readonly schema: AdaptedSchema;
  readonly rows: readonly ResultRow[];
}

// async function parseResultSets(response: Response): Promise<readonly ResultSet[]> {
//   const chunks = getChunkIterator(response);

//   const resultSets: ResultSet[] = [];

//   await bqrs.parse(chunks, (resultSetSchema) => {
//     const columnTypes = resultSetSchema.columns.map((column) => column.type);
//     const rows: ResultRow[] = [];
//     resultSets.push({
//       t: 'RawResultSet',
//       schema: resultSetSchema,
//       rows: rows
//     });

//     return (tuple) => {
//       const row: ResultValue[] = [];
//       tuple.forEach((value, index) => {
//         const type = columnTypes[index];
//         if (type.type === 'e') {
//           const element: ElementBase = value as ElementBase;
//           const label = (element.label !== undefined) ? element.label : element.id.toString(); //REVIEW: URLs?
//           const resolvableLocation = tryGetResolvableLocation(element.location);
//           if (resolvableLocation !== undefined) {
//             row.push({
//               label: label,
//               location: resolvableLocation
//             });
//           }
//           else {
//             // No location link.
//             row.push(label);
//           }
//         }
//         else {
//           row.push(translatePrimitiveValue(value as PrimitiveColumnValue, type.type));
//         }
//       });

//       rows.push(row);
//     };
//   });

//   return resultSets;
// }

// async function* getChunkIterator(response: Response): AsyncIterableIterator<Uint8Array> {
//   if (!response.ok) {
//     throw new Error(`Failed to load results: (${response.status}) ${response.statusText}`);
//   }
//   const reader = response.body!.getReader();
//   while (true) {
//     const { value, done } = await reader.read();
//     if (done) {
//       return;
//     }
//     yield value!;
//   }
// }

// function translatePrimitiveValue(value: PrimitiveColumnValue, type: PrimitiveTypeKind):
//   ResultValue {

//   switch (type) {
//     case 'i':
//     case 'f':
//     case 's':
//     case 'd':
//     case 'b':
//       return value.toString();

//     case 'u':
//       return {
//         uri: value as string
//       };
//   }
// }


function adaptKind(kind: ColumnKind): ColumnType {
  // XXX what about 'u'?
  if (kind == 'e') {
    // XXX?
    return { type: 'e', primitiveType: 's', locationStyle: LocationStyle.FivePart, hasLabel: true }
  }
  else {
    return { type: kind };
  }
}

function adaptColumn(col: Column): ColumnSchema {
  return { name: col.name!, type: adaptKind(col.kind) };
}

export function adaptSchema(schema: ResultSetSchema): AdaptedSchema {
  return {
    columns: schema.columns.map(adaptColumn),
    name: schema.name,
    tupleCount: schema.rows,
    version: 0,
  }
}

export function adaptValue(val: ColumnValue): ResultValue {
  // XXX taking a lot of shortcuts here

  if (typeof val == 'string') {
    return val;
  }
  if (typeof val == 'number' || typeof val == 'boolean') {
    return val + '';
  }

  const url = val.url;

  if (typeof url == 'string') {
    return url;
  }

  if (url == undefined) {
    return 'none';
  }

  return {
    label: 'label:' + val.label || '', uri: 'uri:' + url.uri,
    location: {
      t: LocationStyle.FivePart,
      lineStart: url.startLine,
      lineEnd: url.endLine,
      colStart: url.startColumn,
      colEnd: url.endColumn,
      file: url.uri,
    }
  }

}

export function adaptRow(row: ColumnValue[]): ResultRow {
  return row.map(adaptValue);
}

export function adaptBqrs(schema: AdaptedSchema, page: DecodedBqrsChunk): RawResultSet {
  return {
    schema,
    rows: page.tuples.map(adaptRow),
  }
}
