import type { FormEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  size,
  useDismiss,
  useFloating,
  useFocus,
  useInteractions,
  useListNavigation,
  useRole,
} from "@floating-ui/react";
import { styled } from "styled-components";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { SuggestBoxItem } from "./SuggestBoxItem";
import { useOpenKey } from "./useOpenKey";
import { HighlightedText } from "./HighlightedText";
import { createHighlights } from "./highlight";

const Container = styled.div`
  width: 430px;
  display: flex;
  flex-direction: column;
  border-radius: 3px;
  font-size: 95%;

  background-color: var(--vscode-editorSuggestWidget-background);
  border: 1px solid var(--vscode-editorSuggestWidget-border);

  user-select: none;
`;

const suggestedOptions = [
  {
    label: "Argument[self]",
    icon: "symbol-class",
    details: "sqlite3.SQLite3::Database",
  },
  { label: "Argument[0]", icon: "symbol-parameter", details: "name" },
  { label: "Argument[1]", icon: "symbol-parameter", details: "arity" },
  {
    label: "Argument[text_rep:]",
    icon: "symbol-parameter",
    details: "text_rep:",
  },
  { label: "Argument[block]", icon: "symbol-parameter", details: "&block" },
  { label: "ReturnValue", icon: "symbol-variable", details: undefined },
];

export const SuggestBox = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const listRef = useRef<Array<HTMLElement | null>>([]);

  const { refs, floatingStyles, context } = useFloating<HTMLInputElement>({
    whileElementsMounted: autoUpdate,
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    middleware: [
      // Flip when the popover is too close to the bottom of the screen
      flip({ padding: 10 }),
      // Resize the popover to be fill the available height
      size({
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${availableHeight}px`,
          });
        },
        padding: 10,
      }),
    ],
  });

  const focus = useFocus(context);
  const role = useRole(context, { role: "listbox" });
  const dismiss = useDismiss(context);
  const openKey = useOpenKey(context);
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: setActiveIndex,
    virtual: true,
    loop: true,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [focus, role, dismiss, openKey, listNav],
  );

  const handleInput = useCallback((event: FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    setInputValue(value);
  }, []);

  const matchingItems = useMemo(() => {
    if (!inputValue) {
      return suggestedOptions;
    }

    return suggestedOptions.filter((item) =>
      item.label.toLowerCase().includes(inputValue.toLowerCase()),
    );
  }, [inputValue]);

  return (
    <>
      <VSCodeTextField
        {...getReferenceProps({
          ref: refs.setReference,
          value: inputValue,
          onInput: handleInput,
          "aria-autocomplete": "list",
          onKeyDown: (event) => {
            if (
              event.key === "Enter" &&
              activeIndex != null &&
              matchingItems[activeIndex]
            ) {
              setInputValue(matchingItems[activeIndex].label);
              setActiveIndex(null);
            }
          },
        })}
      />
      <FloatingPortal>
        {isOpen && matchingItems.length > 0 && (
          <FloatingFocusManager
            context={context}
            initialFocus={-1}
            visuallyHiddenDismiss
          >
            <Container
              {...getFloatingProps({
                ref: refs.setFloating,
                style: floatingStyles,
              })}
            >
              {matchingItems.map((item, index) => (
                <SuggestBoxItem
                  key={item.label}
                  {...getItemProps({
                    key: item.label,
                    ref(node) {
                      listRef.current[index] = node;
                    },
                    onClick() {
                      refs.domReference.current?.focus();
                    },
                  })}
                  active={activeIndex === index}
                  icon={item.icon}
                  labelText={
                    <HighlightedText
                      snippets={createHighlights(item.label, inputValue)}
                    />
                  }
                  detailsText={item.details}
                />
              ))}
            </Container>
          </FloatingFocusManager>
        )}
      </FloatingPortal>
    </>
  );
};
