import * as React from "react";
import { select } from "d3";
import { jumpToLocation } from "./result-table-utils";
import { graphviz, GraphvizOptions } from "d3-graphviz";
import { tryGetLocationFromString } from "../../common/bqrs-utils";
import { useCallback, useEffect } from "react";

type GraphProps = {
  graphData: string;
  databaseUri: string;
};

const graphClassName = "vscode-codeql__result-tables-graph";
const graphId = "graph-results";

export function Graph({ graphData, databaseUri }: GraphProps) {
  const renderGraph = useCallback(() => {
    if (!graphData) {
      return;
    }

    const options: GraphvizOptions = {
      fit: true,
      fade: false,
      growEnteringEdges: false,
      zoom: true,
      useWorker: false,
    };

    const element = document.querySelector(`#${graphId}`);
    if (!element) {
      return;
    }
    element.firstChild?.remove();

    const color = getComputedStyle(element).color;
    const backgroundColor = getComputedStyle(element).backgroundColor;
    const borderColor = getComputedStyle(element).borderColor;
    let firstPolygon = true;

    graphviz(`#${graphId}`, options)
      .attributer(function (d) {
        if (d.tag === "a") {
          const url = d.attributes["xlink:href"] || d.attributes["href"];
          const loc = tryGetLocationFromString(url);
          if (loc !== undefined) {
            d.attributes["xlink:href"] = "#";
            d.attributes["href"] = "#";
            loc.uri = `file://${loc.uri}`;
            select(this).on("click", function (e) {
              jumpToLocation(loc, databaseUri);
            });
          }
        }

        if ("fill" in d.attributes) {
          d.attributes.fill = d.tag === "text" ? color : backgroundColor;
        }
        if ("stroke" in d.attributes) {
          // There is no proper way to identify the element containing the graph (which we
          // don't want a border around), as it is just has tag 'polygon'. Instead we assume
          // that the first polygon we see is that element
          if (d.tag !== "polygon" || !firstPolygon) {
            d.attributes.stroke = borderColor;
          } else {
            firstPolygon = false;
          }
        }
      })
      .renderDot(graphData);
  }, [graphData, databaseUri]);

  useEffect(() => {
    renderGraph();
  }, [renderGraph]);

  if (!graphData) {
    return (
      <>
        <div className={graphClassName}>Graph is not available.</div>
      </>
    );
  }

  return (
    <>
      <div className={graphClassName}>
        <strong>Warning:</strong> The Graph Viewer is not a publicly released
        feature and will crash on large graphs.
      </div>
      <div id={graphId} className={graphClassName}>
        <span>Rendering graph...</span>
      </div>
    </>
  );
}
