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

  it("fullMessageWithStack includes the stack", () => {
    expect(
      redactableError`Failed to create database ${"foo"}`.fullMessageWithStack,
    ).toMatch(
      /^Failed to create database foo\nError: Failed to create database foo\n +at redactableError \(/,
    );
  });

  it("fullMessageWithStack includes the cause stack for given error", () => {
    function myRealFunction() {
      throw new Error("Internal error");
    }

    let error: Error;
    try {
      myRealFunction();

      fail("Expected an error to be thrown");
    } catch (e: unknown) {
      if (!(e instanceof Error)) {
        throw new Error("Expected an Error to be thrown");
      }

      error = e;
    }

    expect(
      redactableError(error)`Failed to create database ${"foo"}`
        .fullMessageWithStack,
    ).toMatch(
      /^Failed to create database foo\nError: Internal error\n +at myRealFunction \(/,
    );
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
