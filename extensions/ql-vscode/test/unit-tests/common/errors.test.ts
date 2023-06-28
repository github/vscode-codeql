import { redactableError, RedactableError } from "../../../src/common/errors";

describe("errorMessage", () => {
  it("creates a RedactableError", () => {
    expect(redactableError`Failed to create database ${"foo"}`).toBeInstanceOf(
      RedactableError,
    );
  });

  it("toString() matches the given message", () => {
    expect(
      redactableError`Failed to create database ${"foo"}`.toString(),
    ).toEqual("Failed to create database foo");
  });

  it("fullMessage matches the given message", () => {
    expect(
      redactableError`Failed to create database ${"foo"}`.fullMessage,
    ).toEqual("Failed to create database foo");
  });

  it("redactedMessage redacts the given message", () => {
    expect(
      redactableError`Failed to create database ${"foo"}`.redactedMessage,
    ).toEqual("Failed to create database [REDACTED]");
  });

  it("fullMessage returns the correct message for nested redactableError", () => {
    expect(
      redactableError`Failed to create database ${redactableError`foo ${"bar"}`}`
        .fullMessage,
    ).toEqual("Failed to create database foo bar");
  });

  it("redactedMessage returns the correct message for nested redactableError", () => {
    expect(
      redactableError`Failed to create database ${redactableError`foo ${"bar"}`}`
        .redactedMessage,
    ).toEqual("Failed to create database foo [REDACTED]");
  });
});
