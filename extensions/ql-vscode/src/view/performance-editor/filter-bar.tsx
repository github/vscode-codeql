import * as React from "react";

import {
  VSCodeTextField,
  VSCodeButton,
} from "@vscode/webview-ui-toolkit/react";

import "./filterBar.css";

export interface FilterBarProps {
  // fired whenever buttons are toggled or text is changed
  onFilterChange: (filter: string, state: FilterBarState) => void;
  onToggleAmortizeCostAcrossQueries: (amortize: boolean) => void;
}

export interface FilterBarState {
  show?: boolean;
  amortizeCostAcrossQueries: boolean;
}

export class FilterBar extends React.Component<FilterBarProps, FilterBarState> {
  private timerHandle: NodeJS.Timeout | undefined;

  constructor(props: any) {
    super(props);

    this.state = {
      amortizeCostAcrossQueries: false,
    };

    this.filterTextChanged = this.filterTextChanged.bind(this);
    this.toggleAmortizeCostAcrossQueries =
      this.toggleAmortizeCostAcrossQueries.bind(this);
  }

  filterTextChanged(e: { target: HTMLInputElement }) {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
    }
    // "debounce" -- 300ms seems about right.
    this.timerHandle = setTimeout(() => {
      this.props.onFilterChange?.(e.target.value.trim(), this.state);
    }, 300);
  }

  toggleAmortizeCostAcrossQueries() {
    const shouldAmortize = !this.state.amortizeCostAcrossQueries;
    console.log(`OLD = ${this.state.amortizeCostAcrossQueries}`);
    this.setState({
      amortizeCostAcrossQueries: shouldAmortize,
    });
    console.log(`NEW = ${shouldAmortize}`);

    this.props.onToggleAmortizeCostAcrossQueries(shouldAmortize);
  }

  render(): JSX.Element {
    return (
      <div style={{ width: "100%" }}>
        <VSCodeTextField
          style={{ width: "100%" }}
          onInput={this.filterTextChanged}
        >
          Filter Predicates
          <span slot="start" className="codicon codicon-filter"></span>
          <section slot="end" style={{ display: "flex", alignItems: "center" }}>
            <VSCodeButton
              appearance="icon"
              className={
                this.state.amortizeCostAcrossQueries
                  ? "filter-button-selected"
                  : ""
              }
              ariaLabel="Amortize Cost Across Queries"
              onClick={this.toggleAmortizeCostAcrossQueries}
            >
              <span className="codicon codicon-law"></span>
            </VSCodeButton>
          </section>
        </VSCodeTextField>
      </div>
    );
  }
}
