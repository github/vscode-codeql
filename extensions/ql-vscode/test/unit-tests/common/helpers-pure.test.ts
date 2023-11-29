import {
  asyncFilter,
  djb2,
  getErrorMessage,
  hashMad,
} from "../../../src/common/helpers-pure";

describe("helpers-pure", () => {
  it("should filter asynchronously", async () => {
    expect(await asyncFilter([1, 2, 3], (x) => Promise.resolve(x > 2))).toEqual(
      [3],
    );
  });

  it("should throw on error when filtering", async () => {
    const rejects = (x: number) =>
      x === 3 ? Promise.reject(new Error("opps")) : Promise.resolve(true);

    try {
      await asyncFilter([1, 2, 3], rejects);
      throw new Error("Should have thrown");
    } catch (e) {
      expect(getErrorMessage(e)).toBe("opps");
    }
  });

  /*
    	[empty string]	5,381
2	java.util	-1,445,246,957
3	run	193,431,916
4	getName	-1,502,699,660
5	clone	176,907,662
6	main	2,087,696,334
7	java.lang	-1,444,439,341
8	start	195,030,917
9	loadChildren	-1,971,081,232
10	init	2,087,826,463
11	getDescription	757,227,477
12	toString	1,741,583,947
*/
  it("should hash single values properly", () => {
    expect(djb2("")).toBe(5381);
    expect(djb2("java.util")).toBe(-1445246957);
    expect(djb2("run")).toBe(193431916);
    expect(djb2("getName")).toBe(-1502699660);
    expect(djb2("clone")).toBe(176907662);
    expect(djb2("main")).toBe(2087696334);
    expect(djb2("java.lang")).toBe(-1444439341);
    expect(djb2("start")).toBe(195030917);
    expect(djb2("loadChildren")).toBe(-1971081232);
    expect(djb2("init")).toBe(2087826463);
    expect(djb2("getDescription")).toBe(757227477);
    expect(djb2("toString")).toBe(1741583947);
  });

  /*
1	java.util	Enumeration	true	asIterator	[empty string]	[empty string]	Argument[this].Element	ReturnValue.Element	value	manual	1,679,884,592
2	java.util	Enumeration	true	nextElement	[empty string]	[empty string]	Argument[this].Element	ReturnValue	value	manual	307,746,703
3	java.util	Scanner	true	next	[empty string]	[empty string]	Argument[this]	ReturnValue	taint	manual	-1,602,956,821
4	java.util	Scanner	true	reset	[empty string]	[empty string]	Argument[this]	ReturnValue	value	manual	-61,135,750
5	java.util	Scanner	true	nextByte	[empty string]	[empty string]	Argument[this]	ReturnValue	taint	manual	1,270,097,313
6	java.util	Scanner	true	skip	[empty string]	[empty string]	Argument[this]	ReturnValue	value	manual	1,643,621,326
*/

  it("should hash multiple values properly", () => {
    expect(
      hashMad([
        "java.util",
        "Enumeration",
        true,
        "asIterator",
        "",
        "",
        "Argument[this].Element",
        "ReturnValue.Element",
        "value",
        "manual",
      ]),
    ).toBe("1679884592");
    expect(
      hashMad([
        "java.util",
        "Enumeration",
        true,
        "nextElement",
        "",
        "",
        "Argument[this].Element",
        "ReturnValue",
        "value",
        "manual",
      ]),
    ).toBe("307746703");
    expect(
      hashMad([
        "java.util",
        "Scanner",
        true,
        "next",
        "",
        "",
        "Argument[this]",
        "ReturnValue",
        "taint",
        "manual",
      ]),
    ).toBe("-1602956821");
    expect(
      hashMad([
        "java.util",
        "Scanner",
        true,
        "reset",
        "",
        "",
        "Argument[this]",
        "ReturnValue",
        "value",
        "manual",
      ]),
    ).toBe("-61135750");
    expect(
      hashMad([
        "java.util",
        "Scanner",
        true,
        "nextByte",
        "",
        "",
        "Argument[this]",
        "ReturnValue",
        "taint",
        "manual",
      ]),
    ).toBe("1270097313");
    expect(
      hashMad([
        "java.util",
        "Scanner",
        true,
        "skip",
        "",
        "",
        "Argument[this]",
        "ReturnValue",
        "value",
        "manual",
      ]),
    ).toBe("1643621326");
  });
});
