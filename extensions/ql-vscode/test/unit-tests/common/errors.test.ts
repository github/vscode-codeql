import {
  errorMessage,
  RedactableErrorMessage,
} from "../../../src/common/errors";

describe("errorMessage", () => {
  it("creates a RedactableErrorMessage", () => {
    expect(errorMessage`Failed to create database ${"foo"}`).toBeInstanceOf(
      RedactableErrorMessage,
    );
  });

  it("toString() matches the given message", () => {
    expect(errorMessage`Failed to create database ${"foo"}`.toString()).toEqual(
      "Failed to create database foo",
    );
  });

  it("fullMessage matches the given message", () => {
    expect(
      errorMessage`Failed to create database ${"foo"}`.fullMessage,
    ).toEqual("Failed to create database foo");
  });

  it("redactedMessage redacts the given message", () => {
    expect(
      errorMessage`Failed to create database ${"foo"}`.redactedMessage,
    ).toEqual("Failed to create database [REDACTED]");
  });
});
