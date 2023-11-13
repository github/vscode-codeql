import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodModelingInputs as MethodModelingInputsComponent } from "../../view/method-modeling/MethodModelingInputs";
import { createMethod } from "../../../test/factories/model-editor/method-factories";
import { createSinkModeledMethod } from "../../../test/factories/model-editor/modeled-method-factories";
import { useState } from "react";
import { ModeledMethod } from "../../model-editor/modeled-method";
import { QueryLanguage } from "../../common/query-language";

export default {
  title: "Method Modeling/Method Modeling Inputs",
  component: MethodModelingInputsComponent,
  argTypes: {
    modeledMethod: {
      control: {
        disable: true,
      },
    },
  },
} as Meta<typeof MethodModelingInputsComponent>;

const Template: StoryFn<typeof MethodModelingInputsComponent> = (args) => {
  const [m, setModeledMethod] = useState<ModeledMethod | undefined>(
    args.modeledMethod,
  );

  const onChange = (modeledMethod: ModeledMethod) => {
    setModeledMethod(modeledMethod);
  };

  return (
    <MethodModelingInputsComponent
      {...args}
      language={QueryLanguage.Java}
      modeledMethod={m}
      onChange={onChange}
    />
  );
};

const method = createMethod();
const modeledMethod = createSinkModeledMethod();

export const UnmodeledMethod = Template.bind({});
UnmodeledMethod.args = {
  method,
};

export const FullyModeledMethod = Template.bind({});
FullyModeledMethod.args = {
  method,
  modeledMethod,
};

export const ModelingInProgress = Template.bind({});
ModelingInProgress.args = {
  method,
  modeledMethod,
  isModelingInProgress: true,
};

const generatedModeledMethod = createSinkModeledMethod({
  provenance: "ai-generated",
});
export const ModelingNotAccepted = Template.bind({});
ModelingNotAccepted.args = {
  method,
  modeledMethod: generatedModeledMethod,
  modelingStatus: "unsaved",
};
