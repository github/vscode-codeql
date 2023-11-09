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
import { css, styled } from "styled-components";
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { SuggestBoxItem } from "./SuggestBoxItem";
import { useOpenKey } from "./useOpenKey";
import { findMatchingOptions, suggestedOptions } from "./suggestions";
import { LabelText } from "./LabelText";
import { validateAccessPath } from "./access-path";

const Input = styled(VSCodeTextField)<{ $error: boolean }>`
  width: 430px;

  font-family: var(--vscode-editor-font-family);

  ${(props) =>
    props.$error &&
    css`
      --dropdown-border: var(--vscode-inputValidation-errorBorder);
      --focus-border: var(--vscode-inputValidation-errorBorder);
    `}
`;

const Container = styled.div`
  width: 430px;
  display: flex;
  flex-direction: column;
  border-radius: 3px;

  background-color: var(--vscode-editorSuggestWidget-background);
  border: 1px solid var(--vscode-editorSuggestWidget-border);

  user-select: none;
`;

const ListContainer = styled(Container)`
  font-size: 95%;
`;

const NoSuggestionsContainer = styled(Container)`
  padding-top: 2px;
  padding-bottom: 2px;
`;

const NoSuggestionsText = styled.div`
  padding-left: 22px;
`;

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
    setIsOpen(true);
    setActiveIndex(0);
  }, []);

  const suggestionItems = useMemo(() => {
    return findMatchingOptions(suggestedOptions, inputValue);
  }, [inputValue]);

  const diagnostics = useMemo(
    () => validateAccessPath(inputValue),
    [inputValue],
  );

  const hasSyntaxError = diagnostics.length > 0;

  return (
    <>
      <Input
        {...getReferenceProps({
          ref: refs.setReference,
          value: inputValue,
          onInput: handleInput,
          "aria-autocomplete": "list",
          onKeyDown: (event) => {
            if (
              event.key === "Enter" &&
              activeIndex != null &&
              suggestionItems[activeIndex]
            ) {
              setInputValue(suggestionItems[activeIndex].value);
              setActiveIndex(null);
              setIsOpen(false);
            }
          },
        })}
        $error={hasSyntaxError}
      />
      {isOpen && (
        <FloatingPortal>
          {inputValue && suggestionItems.length === 0 && (
            <NoSuggestionsContainer
              {...getFloatingProps({
                ref: refs.setFloating,
                style: floatingStyles,
              })}
            >
              <NoSuggestionsText>No suggestions.</NoSuggestionsText>
            </NoSuggestionsContainer>
          )}
          {suggestionItems.length > 0 && (
            <FloatingFocusManager
              context={context}
              initialFocus={-1}
              visuallyHiddenDismiss
            >
              <ListContainer
                {...getFloatingProps({
                  ref: refs.setFloating,
                  style: floatingStyles,
                })}
              >
                {suggestionItems.map((item, index) => (
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
                      <LabelText item={item} inputValue={inputValue} />
                    }
                    detailsText={item.details}
                  />
                ))}
              </ListContainer>
            </FloatingFocusManager>
          )}
        </FloatingPortal>
      )}
    </>
  );
};
