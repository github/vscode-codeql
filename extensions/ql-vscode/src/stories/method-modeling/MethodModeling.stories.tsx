import * as React from "react";

import { Meta, StoryFn } from "@storybook/react";

import { MethodModeling as MethodModelingComponent } from "../../view/method-modeling/MethodModeling";
import { createMethod } from "../../../test/factories/model-editor/method-factories";
import {
  createNeutralModeledMethod,
  createSinkModeledMethod,
  createSourceModeledMethod,
} from "../../../test/factories/model-editor/modeled-method-factories";
import { QueryLanguage } from "../../common/query-language";

export default {
  title: "Method Modeling/Method Modeling",
  component: MethodModelingComponent,
} as Meta<typeof MethodModelingComponent>;

const Template: StoryFn<typeof MethodModelingComponent> = (args) => (
  <MethodModelingComponent {...args} />
);

const method = createMethod();
const language = QueryLanguage.Java;

export const MethodUnmodeled = Template.bind({});
MethodUnmodeled.args = {
  language,
  method,
  modeledMethods: [],
  modelingStatus: "unmodeled",
};

export const MethodModeled = Template.bind({});
MethodModeled.args = {
  language,
  method,
  modeledMethods: [],
  modelingStatus: "unsaved",
};

export const MethodSaved = Template.bind({});
MethodSaved.args = {
  language,
  method,
  modeledMethods: [],
  modelingStatus: "saved",
};

export const MultipleModelingsUnmodeled = Template.bind({});
MultipleModelingsUnmodeled.args = {
  language,
  method,
  modeledMethods: [],
  modelingStatus: "saved",
  showMultipleModels: true,
};

export const MultipleModelingsModeledSingle = Template.bind({});
MultipleModelingsModeledSingle.args = {
  language,
  method,
  modeledMethods: [createSinkModeledMethod(method)],
  modelingStatus: "saved",
  showMultipleModels: true,
};

export const MultipleModelingsModeledMultiple = Template.bind({});
MultipleModelingsModeledMultiple.args = {
  language,
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
  modelingStatus: "saved",
  showMultipleModels: true,
};

export const MultipleModelingsValidationFailedNeutral = Template.bind({});
MultipleModelingsValidationFailedNeutral.args = {
  language,
  method,
  modeledMethods: [
    createSinkModeledMethod(method),
    createNeutralModeledMethod(method),
  ],
  modelingStatus: "unsaved",
  showMultipleModels: true,
};

export const MultipleModelingsValidationFailedDuplicate = Template.bind({});
MultipleModelingsValidationFailedDuplicate.args = {
  language,
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
  modelingStatus: "unsaved",
  showMultipleModels: true,
};
