type ExtensibleReference = {
  pack: string;
  extensible: string;
};

export type DataTuple = boolean | number | string;

export type DataRow = DataTuple[];

type ModelExtension = {
  addsTo: ExtensibleReference;
  data: DataRow[];
};

export type ModelExtensionFile = {
  extensions: ModelExtension[];
};
