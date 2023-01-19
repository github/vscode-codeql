# Using protobuf

We use [protobuf-es][1] to define schemas for the data we store on disk. 

We define our schemas in the `proto` folder. These are transformed into 
typescript types by running the `buf generate proto` command in the terminal.

The advantages with protobuf are:
1. It supports versioning. If you add a new field, it will support previous versions which don't have the field. 
2. It can do both JSON and binary when writing to disk.
3. It generates typescript types

## Terminology

1. Schema

Since we already have types called VariantAnalysis or RemoteQuery, we're not able to name our protobuf
files with the same name since they will be transformed into Typescript types. 

So our proto files are called "schemas", e.g. VariantAnalysisSchema. 

2. Message

The syntax used by protobuf-es to declare a new type is to define it as a `message`. 

## Defining a new schema

1. Create a new file in the `proto` folder.
2. Define a new message.
3. Run `npm run generate:schemas` in the terminal. This will generate Typescript types in the `src/proto-generated` 
folder.

The list of fields you can add to a schema can be found here:
https://github.com/bufbuild/protobuf-es/blob/main/docs/runtime_api.md

More detailed docs on each field type:
https://developers.google.com/protocol-buffers/docs/proto3

## Linting

Any ES Lint change would be overwritten when we regenerate the schemas so we've disabled eslint on these generated types.

[1]: https://buf.build/blog/protobuf-es-the-protocol-buffers-typescript-javascript-runtime-we-all-deserve
