type ExtensibleReference = {
  pack: string;
  extensible: string;
};

export type DataTuple = boolean | number | string;

type DataRow = DataTuple[];

export type ModelExtension = {
  addsTo: ExtensibleReference;
  data: DataRow[];
};

export type ModelExtensionFile = {
  extensions: ModelExtension[];
};
