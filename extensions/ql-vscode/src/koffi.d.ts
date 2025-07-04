// koffi/indirect is untyped in the upstream package, but it exports the same functions as koffi.
declare module "koffi/indirect" {
  export * from "koffi";
}
