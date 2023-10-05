import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodModelingInputs as MethodModelingInputsComponent } from "../../view/method-modeling/MethodModelingInputs";
import { createMethod } from "../../../test/factories/model-editor/method-factories";
import { createModeledMethod } from "../../../test/factories/model-editor/modeled-method-factories";
import { useState } from "react";
import { ModeledMethod } from "../../model-editor/modeled-method";

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
      modeledMethod={m}
      onChange={onChange}
    />
  );
};

const method = createMethod();
const modeledMethod = createModeledMethod();

export const UnmodeledMethod = Template.bind({});
UnmodeledMethod.args = {
  method,
};

export const FullyModeledMethod = Template.bind({});
FullyModeledMethod.args = {
  method,
  modeledMethod,
};
