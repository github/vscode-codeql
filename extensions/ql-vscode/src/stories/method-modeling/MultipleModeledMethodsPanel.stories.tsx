import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MultipleModeledMethodsPanel as MultipleModeledMethodsPanelComponent } from "../../view/method-modeling/MultipleModeledMethodsPanel";
import { createMethod } from "../../../test/factories/model-editor/method-factories";
import { createModeledMethod } from "../../../test/factories/model-editor/modeled-method-factories";
import { ModeledMethod } from "../../model-editor/modeled-method";

export default {
  title: "Method Modeling/Multiple Modeled Methods Panel",
  component: MultipleModeledMethodsPanelComponent,
} as Meta<typeof MultipleModeledMethodsPanelComponent>;

const Template: StoryFn<typeof MultipleModeledMethodsPanelComponent> = (
  args,
) => {
  const [modeledMethods, setModeledMethods] = useState<ModeledMethod[]>(
    args.modeledMethods,
  );

  useEffect(() => {
    setModeledMethods(args.modeledMethods);
  }, [args.modeledMethods]);

  const handleChange = useCallback(
    (methodSignature: string, modeledMethods: ModeledMethod[]) => {
      args.onChange(methodSignature, modeledMethods);
      setModeledMethods(modeledMethods);
    },
    [args],
  );

  return (
    <MultipleModeledMethodsPanelComponent
      {...args}
      modeledMethods={modeledMethods}
      onChange={handleChange}
    />
  );
};

const method = createMethod();

export const Unmodeled = Template.bind({});
Unmodeled.args = {
  method,
  modeledMethods: [],
};

export const Single = Template.bind({});
Single.args = {
  method,
  modeledMethods: [createModeledMethod(method)],
};

export const Multiple = Template.bind({});
Multiple.args = {
  method,
  modeledMethods: [
    createModeledMethod(method),
    createModeledMethod({
      ...method,
      type: "source",
      input: "",
      output: "ReturnValue",
      kind: "remote",
    }),
  ],
};
