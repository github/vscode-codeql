import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodModeling as MethodModelingComponent } from "../../view/method-modeling/MethodModeling";
import { createMethod } from "../../../test/factories/model-editor/method-factories";
import {
  createNeutralModeledMethod,
  createSinkModeledMethod,
  createSourceModeledMethod,
} from "../../../test/factories/model-editor/modeled-method-factories";
export default {
  title: "Method Modeling/Method Modeling",
  component: MethodModelingComponent,
} as Meta<typeof MethodModelingComponent>;

const Template: StoryFn<typeof MethodModelingComponent> = (args) => (
  <MethodModelingComponent {...args} />
);

const method = createMethod();

export const MethodUnmodeled = Template.bind({});
MethodUnmodeled.args = {
  method,
  modeledMethods: [],
  modelingStatus: "unmodeled",
};

export const MethodModeled = Template.bind({});
MethodModeled.args = {
  method,
  modeledMethods: [],
  modelingStatus: "unsaved",
};

export const MethodSaved = Template.bind({});
MethodSaved.args = {
  method,
  modeledMethods: [],
  modelingStatus: "saved",
};

export const MultipleModelingsUnmodeled = Template.bind({});
MultipleModelingsUnmodeled.args = {
  method,
  modeledMethods: [],
  showMultipleModels: true,
  modelingStatus: "saved",
};

export const MultipleModelingsModeledSingle = Template.bind({});
MultipleModelingsModeledSingle.args = {
  method,
  modeledMethods: [createSinkModeledMethod(method)],
  showMultipleModels: true,
  modelingStatus: "saved",
};

export const MultipleModelingsModeledMultiple = Template.bind({});
MultipleModelingsModeledMultiple.args = {
  method,
  modeledMethods: [
    createSinkModeledMethod(method),
    createSourceModeledMethod({
      ...method,
      type: "source",
      output: "ReturnValue",
      kind: "remote",
    }),
  ],
  showMultipleModels: true,
  modelingStatus: "saved",
};

export const MultipleModelingsValidationFailedNeutral = Template.bind({});
MultipleModelingsValidationFailedNeutral.args = {
  method,
  modeledMethods: [
    createSinkModeledMethod(method),
    createNeutralModeledMethod(method),
  ],
  showMultipleModels: true,
  modelingStatus: "unsaved",
};

export const MultipleModelingsValidationFailedDuplicate = Template.bind({});
MultipleModelingsValidationFailedDuplicate.args = {
  method,
  modeledMethods: [
    createSinkModeledMethod(method),
    createSourceModeledMethod({
      ...method,
      output: "ReturnValue",
      kind: "remote",
    }),
    createSinkModeledMethod(method),
  ],
  showMultipleModels: true,
  modelingStatus: "unsaved",
};
