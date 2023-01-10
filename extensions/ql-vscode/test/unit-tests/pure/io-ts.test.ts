import * as t from "io-ts";
import { validateApiResponse } from "../../../src/pure/io-ts";

describe("validateApiResponse", () => {
  const type = t.type({
    id: t.number,
    name: t.string,
  });

  it("should return the response data if it is valid", () => {
    const data = {
      id: 1,
      name: "foo",
    };

    const result = validateApiResponse(data, type);
    expect(result).toEqual(data);
  });

  it("should throw an error if the response data is invalid", () => {
    const data = {
      id: 1,
      name: 2,
    };

    expect(() => validateApiResponse(data, type)).toThrow(
      "Invalid response from GitHub API: Invalid value 2 supplied to .name",
    );
  });

  it("should return the response data if it contains extra fields", () => {
    const data = {
      id: 1,
      name: "foo",
      extra: "bar",
    };

    const result = validateApiResponse(data, type);
    expect(result).toEqual(data);
  });

  it("should throw an error if the response data is null", () => {
    expect(() => validateApiResponse(null, type)).toThrow(
      "Invalid response from GitHub API: Invalid value null supplied to .",
    );
  });

  it("should throw an error if the response data is undefined", () => {
    expect(() => validateApiResponse(undefined, type)).toThrow(
      "Invalid response from GitHub API: Invalid value undefined supplied to .",
    );
  });
});
