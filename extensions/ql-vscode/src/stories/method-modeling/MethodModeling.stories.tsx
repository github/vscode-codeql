import type { Meta, StoryFn } from "@storybook/react";

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

export const ModeledSingle = Template.bind({});
ModeledSingle.args = {
  language,
  method,
  modeledMethods: [createSinkModeledMethod(method)],
  modelingStatus: "saved",
};

export const ModeledMultiple = Template.bind({});
ModeledMultiple.args = {
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
};

export const ValidationFailedNeutral = Template.bind({});
ValidationFailedNeutral.args = {
  language,
  method,
  modeledMethods: [
    createSinkModeledMethod(method),
    createNeutralModeledMethod(method),
  ],
  modelingStatus: "unsaved",
};

export const ValidationFailedDuplicate = Template.bind({});
ValidationFailedDuplicate.args = {
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
};
