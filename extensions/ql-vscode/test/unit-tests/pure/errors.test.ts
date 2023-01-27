import {
  redactableErrorMessage,
  RedactableErrorMessage,
} from "../../../src/pure/errors";

describe("errorMessage", () => {
  it("creates a RedactableErrorMessage", () => {
    expect(
      redactableErrorMessage`Failed to create database ${"foo"}`,
    ).toBeInstanceOf(RedactableErrorMessage);
  });

  it("toString() matches the given message", () => {
    expect(
      redactableErrorMessage`Failed to create database ${"foo"}`.toString(),
    ).toEqual("Failed to create database foo");
  });

  it("fullMessage matches the given message", () => {
    expect(
      redactableErrorMessage`Failed to create database ${"foo"}`.fullMessage,
    ).toEqual("Failed to create database foo");
  });

  it("redactedMessage redacts the given message", () => {
    expect(
      redactableErrorMessage`Failed to create database ${"foo"}`
        .redactedMessage,
    ).toEqual("Failed to create database [REDACTED]");
  });

  it("fullMessage returns the correct message for nested redactableErrorMessage", () => {
    expect(
      redactableErrorMessage`Failed to create database ${redactableErrorMessage`foo ${"bar"}`}`
        .fullMessage,
    ).toEqual("Failed to create database foo bar");
  });

  it("redactedMessage returns the correct message for nested redactableErrorMessage", () => {
    expect(
      redactableErrorMessage`Failed to create database ${redactableErrorMessage`foo ${"bar"}`}`
        .redactedMessage,
    ).toEqual("Failed to create database foo [REDACTED]");
  });
});
