import { useCallback, useEffect, useState } from "react";

import type { Meta, StoryFn } from "@storybook/react";

import { MultipleModeledMethodsPanel as MultipleModeledMethodsPanelComponent } from "../../view/method-modeling/MultipleModeledMethodsPanel";
import { createMethod } from "../../../test/factories/model-editor/method-factories";
import {
  createSinkModeledMethod,
  createSourceModeledMethod,
} from "../../../test/factories/model-editor/modeled-method-factories";
import type { ModeledMethod } from "../../model-editor/modeled-method";
import { QueryLanguage } from "../../common/query-language";

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
const language = QueryLanguage.Java;

export const Unmodeled = Template.bind({});
Unmodeled.args = {
  language,
  method,
  modeledMethods: [],
};

export const Single = Template.bind({});
Single.args = {
  language,
  method,
  modeledMethods: [createSinkModeledMethod(method)],
};

export const Multiple = Template.bind({});
Multiple.args = {
  language,
  method,
  modeledMethods: [
    createSinkModeledMethod(method),
    createSourceModeledMethod({
      ...method,
      output: "ReturnValue",
      kind: "remote",
    }),
  ],
};
