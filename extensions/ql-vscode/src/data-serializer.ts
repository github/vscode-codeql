import { SchemaTransformer } from "./schema-transformer";

export class DataSerializer {
  public static serializeToJSON(item: any): string {
    const schemaItem = SchemaTransformer.toSchema(item);
    return schemaItem.toJsonString();
  }

  public static deserializeFromJSON(item: JSON): any {
    return SchemaTransformer.fromSchema(item);
  }

  public static serializeToBinary(item: any): Uint8Array {
    const schemaItem = SchemaTransformer.toSchema(item);
    return schemaItem.toBinary();
  }

  public static deserializeFromBinary(item: Uint8Array): any {
    return SchemaTransformer.fromSchema(item);
  }

  public static serializeArrayToJSON(items: any[]): string {
    const schemaItems = items.map((item) => SchemaTransformer.toSchema(item));
    return schemaItems.map((item) => item.toJsonString()).join("");
  }

  public static deserializeArrayFromJSON(items: JSON[]): any[] {
    return items.map((item) => SchemaTransformer.fromSchema(item));
  }
}
