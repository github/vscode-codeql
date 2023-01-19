export class DataSerializer {
    public static serializeToJSON(type: any, item: any): string {
      const schemaItem = type.convertToSchema(item);
      return schemaItem.toJson();
    }

    public static deserializeFromJSON<T>(type: any, item: JSON): T {
      return type.converFromSchema(item);
    }

    public static serializeToBinary(type: any, item: any): Uint8Array {
      const schemaItem = type.convertToSchema(item);
      return schemaItem.toBinary();
    }

    public static deserializeFromBinary<T>(type: any, item: JSON): T {
      return type.converFromSchema(item);
    }

    public static serializeArrayToJSON(type: any, items: any[]): string {
      const schemaItems = items.map(item => type.convertToSchema(item));
      return schemaItems.map(item => item.toJson()).join('');
    }

    public static deserializeArrayFromJSON<T>(type: any, items: JSON[]): T[] {
      return items.map(item => type.converFromSchema(item));
    }
}
