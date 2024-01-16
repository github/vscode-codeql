import type { KeyboardEvent } from "react";
import { renderHook } from "@testing-library/react";
import type { FloatingContext } from "@floating-ui/react";
import { mockedObject } from "../../../../../test/mocked-object";
import { useOpenKey } from "../useOpenKey";

describe("useOpenKey", () => {
  const onOpenChange = jest.fn();

  beforeEach(() => {
    onOpenChange.mockReset();
  });

  const render = ({ open }: { open: boolean }) => {
    const context = mockedObject<FloatingContext>({
      open,
      onOpenChange,
    });

    const { result } = renderHook(() => useOpenKey(context));

    expect(result.current).toEqual({
      reference: {
        onKeyDown: expect.any(Function),
      },
    });

    const onKeyDown = result.current.reference?.onKeyDown;
    if (!onKeyDown) {
      throw new Error("onKeyDown is undefined");
    }

    return {
      onKeyDown,
    };
  };

  const mockKeyboardEvent = ({
    key = "",
    altKey = false,
    ctrlKey = false,
    metaKey = false,
    shiftKey = false,
    preventDefault = jest.fn(),
  }: Partial<KeyboardEvent>) =>
    mockedObject<KeyboardEvent>({
      key,
      altKey,
      ctrlKey,
      metaKey,
      shiftKey,
      preventDefault,
    });

  const pressKey = (event: Parameters<typeof mockKeyboardEvent>[0]) => {
    const { onKeyDown } = render({
      open: false,
    });

    const keyboardEvent = mockKeyboardEvent(event);

    onKeyDown(keyboardEvent);

    return {
      onKeyDown,
      keyboardEvent,
    };
  };

  it("opens when pressing Ctrl + Space and it is closed", () => {
    const { keyboardEvent } = pressKey({
      key: " ",
      ctrlKey: true,
    });

    expect(keyboardEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(true, keyboardEvent);
  });

  it("does not open when pressing Ctrl + Space and it is open", () => {
    const { onKeyDown } = render({
      open: true,
    });

    // Do not mock any properties to ensure that none of them are used.
    const keyboardEvent = mockedObject<KeyboardEvent>({});

    onKeyDown(keyboardEvent);

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not open when pressing Cmd + Space", () => {
    pressKey({
      key: " ",
      metaKey: true,
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not open when pressing Ctrl + Shift + Space", () => {
    pressKey({
      key: " ",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not open when pressing Ctrl + Alt + Space", () => {
    pressKey({
      key: " ",
      ctrlKey: true,
      altKey: true,
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not open when pressing Ctrl + Cmd + Space", () => {
    pressKey({
      key: " ",
      ctrlKey: true,
      metaKey: true,
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not open when pressing Ctrl + Shift + Alt + Space", () => {
    pressKey({
      key: " ",
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not open when pressing Space", () => {
    pressKey({
      key: " ",
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not open when pressing Ctrl + Tab", () => {
    pressKey({
      key: "Tab",
      ctrlKey: true,
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not open when pressing Ctrl + a letter", () => {
    pressKey({
      key: "a",
      ctrlKey: true,
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not change reference when the context changes", () => {
    const context = mockedObject<FloatingContext>({
      open: false,
      onOpenChange,
    });

    const { result, rerender } = renderHook((context) => useOpenKey(context), {
      initialProps: context,
    });

    const firstOnKeyDown = result.current.reference?.onKeyDown;
    expect(firstOnKeyDown).toBeDefined();

    rerender(
      mockedObject<FloatingContext>({
        open: true,
        onOpenChange: jest.fn(),
      }),
    );

    const secondOnKeyDown = result.current.reference?.onKeyDown;
    // test that useEffectEvent is used correctly and the reference doesn't change
    expect(secondOnKeyDown).toBe(firstOnKeyDown);
  });
});
