import type { Method } from "../../../../src/model-editor/method";
import { EndpointType } from "../../../../src/model-editor/method";
import type { ModeledMethod } from "../../../../src/model-editor/modeled-method";
import { getCandidates } from "../../../../src/model-editor/shared/auto-model-candidates";
import { Mode } from "../../../../src/model-editor/shared/mode";

describe("getCandidates", () => {
  it("doesn't return methods that are already modelled", () => {
    const methods: Method[] = [
      {
        library: "my.jar",
        signature: "org.my.A#x()",
        endpointType: EndpointType.Method,
        packageName: "org.my",
        typeName: "A",
        methodName: "x",
        methodParameters: "()",
        supported: false,
        supportedType: "none",
        usages: [],
      },
    ];
    const modeledMethods: Record<string, ModeledMethod[]> = {
      "org.my.A#x()": [
        {
          type: "neutral",
          kind: "sink",
          provenance: "manual",
          signature: "org.my.A#x()",
          endpointType: EndpointType.Method,
          packageName: "org.my",
          typeName: "A",
          methodName: "x",
          methodParameters: "()",
        },
      ],
    };
    const candidates = getCandidates(
      Mode.Application,
      methods,
      modeledMethods,
      new Set(),
    );
    expect(candidates.length).toEqual(0);
  });

  it("doesn't return methods that are supported from other sources", () => {
    const methods: Method[] = [
      {
        library: "my.jar",
        signature: "org.my.A#x()",
        endpointType: EndpointType.Method,
        packageName: "org.my",
        typeName: "A",
        methodName: "x",
        methodParameters: "()",
        supported: true,
        supportedType: "none",
        usages: [],
      },
    ];
    const modeledMethods = {};
    const candidates = getCandidates(
      Mode.Application,
      methods,
      modeledMethods,
      new Set(),
    );
    expect(candidates.length).toEqual(0);
  });

  it("doesn't return methods that are already processed by auto model", () => {
    const methods: Method[] = [
      {
        library: "my.jar",
        signature: "org.my.A#x()",
        endpointType: EndpointType.Method,
        packageName: "org.my",
        typeName: "A",
        methodName: "x",
        methodParameters: "()",
        supported: false,
        supportedType: "none",
        usages: [],
      },
    ];
    const modeledMethods = {};
    const candidates = getCandidates(
      Mode.Application,
      methods,
      modeledMethods,
      new Set(["org.my.A#x()"]),
    );
    expect(candidates.length).toEqual(0);
  });

  it("returns methods that are neither modeled nor supported from other sources", () => {
    const methods: Method[] = [];
    methods.push({
      library: "my.jar",
      signature: "org.my.A#x()",
      endpointType: EndpointType.Method,
      packageName: "org.my",
      typeName: "A",
      methodName: "x",
      methodParameters: "()",
      supported: false,
      supportedType: "none",
      usages: [],
    });
    const modeledMethods = {};
    const candidates = getCandidates(
      Mode.Application,
      methods,
      modeledMethods,
      new Set(),
    );
    expect(candidates.length).toEqual(1);
  });
});
