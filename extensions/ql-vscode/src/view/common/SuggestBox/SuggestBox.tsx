import type { FormEvent, ReactNode } from "react";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
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
import type { Option } from "./options";
import { findMatchingOptions } from "./options";
import { SuggestBoxItem } from "./SuggestBoxItem";

const Input = styled(VSCodeTextField)`
  width: 430px;

  font-family: var(--vscode-editor-font-family);
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

type Props<T extends Option<T>> = {
  value?: string;
  onChange: (value: string) => void;
  options: T[];

  /**
   * Parse the value into tokens that can be used to match against the options. The
   * tokens will be passed to {@link findMatchingOptions}.
   * @param value The user-entered value to parse.
   */
  parseValueToTokens: (value: string) => string[];

  /**
   * Get the icon to display for an option.
   * @param option The option to get the icon for.
   */
  getIcon?: (option: T) => ReactNode | undefined;
  /**
   * Get the details text to display for an option.
   * @param option The option to get the details for.
   */
  getDetails?: (option: T) => ReactNode | undefined;

  disabled?: boolean;

  "aria-label"?: string;
};

export const SuggestBox = <T extends Option<T>>({
  value = "",
  onChange,
  options,
  parseValueToTokens,
  getIcon,
  getDetails,
  disabled,
  "aria-label": ariaLabel,
}: Props<T>) => {
  const [isOpen, setIsOpen] = useState(false);
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
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: setActiveIndex,
    virtual: true,
    loop: true,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [focus, role, dismiss, listNav],
  );

  const handleInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      onChange(value);
      setIsOpen(true);
      setActiveIndex(0);
    },
    [onChange],
  );

  const suggestionItems = useMemo(() => {
    return findMatchingOptions(options, parseValueToTokens(value));
  }, [options, value, parseValueToTokens]);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <>
      <Input
        {...getReferenceProps({
          ref: refs.setReference,
          value,
          onInput: handleInput,
          "aria-autocomplete": "list",
          "aria-label": ariaLabel,
          onKeyDown: (event) => {
            // When the user presses the enter key, select the active item
            if (
              event.key === "Enter" &&
              activeIndex !== null &&
              suggestionItems[activeIndex]
            ) {
              onChange(suggestionItems[activeIndex].value);
              setActiveIndex(null);
              setIsOpen(false);
            }
          },
          disabled,
        })}
      />
      {isOpen && (
        <FloatingPortal>
          {value && suggestionItems.length === 0 && (
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
                        onChange(item.value);
                        setIsOpen(false);

                        refs.domReference.current?.focus();
                      },
                    })}
                    active={activeIndex === index}
                    icon={getIcon?.(item)}
                    labelText={item.label}
                    details={getDetails?.(item)}
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
