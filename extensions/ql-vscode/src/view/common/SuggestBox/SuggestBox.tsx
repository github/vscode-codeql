import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { Option } from "./options";
import { findMatchingOptions } from "./options";
import { SuggestBoxItem } from "./SuggestBoxItem";
import { LabelText } from "./LabelText";
import type { Diagnostic } from "./diagnostics";
import { useOpenKey } from "./useOpenKey";

const Input = styled(VSCodeTextField)<{ $error: boolean }>`
  width: 100%;
  font-family: var(--vscode-editor-font-family);

  ${(props) =>
    props.$error &&
    css`
      --dropdown-border: var(--vscode-inputValidation-errorBorder);
      --focus-border: var(--vscode-inputValidation-errorBorder);
    `}
`;

const Container = styled.div`
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

export type SuggestBoxProps<
  T extends Option<T>,
  D extends Diagnostic = Diagnostic,
> = {
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
   * Validate the value. This is used to show syntax errors in the input.
   * @param value The user-entered value to validate.
   */
  validateValue?: (value: string) => D[];

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

  /**
   * Can be used to render a different component for the input. This is used
   * in testing to use default HTML components rather than the VSCodeTextField
   * for easier testing.
   * @param props The props returned by `getReferenceProps` of {@link useInteractions}
   */
  renderInputComponent?: (
    props: Record<string, unknown>,
    hasError: boolean,
  ) => ReactNode;
};

const stopClickPropagation = (e: React.MouseEvent) => {
  e.stopPropagation();
};

export const SuggestBox = <
  T extends Option<T>,
  D extends Diagnostic = Diagnostic,
>({
  value = "",
  onChange,
  options,
  parseValueToTokens,
  validateValue,
  getIcon,
  getDetails,
  disabled,
  "aria-label": ariaLabel,
  renderInputComponent = (props, hasError) => (
    <Input {...props} $error={hasError} />
  ),
}: SuggestBoxProps<T, D>) => {
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

  const handleInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      const value = event.currentTarget.value;
      onChange(value);
      setIsOpen(true);
      setActiveIndex(0);
    },
    [onChange],
  );

  const tokens = useMemo(() => {
    return parseValueToTokens(value);
  }, [value, parseValueToTokens]);

  const suggestionItems = useMemo(() => {
    return findMatchingOptions(options, tokens);
  }, [options, tokens]);

  const diagnostics = useMemo(
    () => validateValue?.(value) ?? [],
    [validateValue, value],
  );

  const hasSyntaxError = diagnostics.length > 0;

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    // Disabled because the div is used to stop click propagation, it's not a button
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div onClick={stopClickPropagation}>
      {renderInputComponent(
        getReferenceProps({
          ref: refs.setReference,
          value,
          onInput: handleInput,
          "aria-autocomplete": "list",
          "aria-label": ariaLabel,
          onKeyDown: (event) => {
            // When the user presses the enter or tab key, select the active item
            if (
              (event.key === "Enter" || event.key === "Tab") &&
              activeIndex !== null &&
              suggestionItems[activeIndex]
            ) {
              onChange(suggestionItems[activeIndex].value);
              setActiveIndex(null);
              setIsOpen(false);
            }
          },
          disabled,
        }),
        hasSyntaxError,
      )}
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
              // The default for returnFocus is true, but this doesn't work when opening
              // the command palette in a VS Code webview. The focus is returned to the
              // input element, but this closes the command palette immediately after opening
              // it. By setting returnFocus to false, the focus is not immediately given to
              // the input element, so the command palette stays open.
              returnFocus={false}
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
                    labelText={<LabelText tokens={tokens} item={item} />}
                    details={getDetails?.(item)}
                  />
                ))}
              </ListContainer>
            </FloatingFocusManager>
          )}
        </FloatingPortal>
      )}
    </div>
  );
};
