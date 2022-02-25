/**
 * The d3 library is designed to work in both the browser and
 * node. Consequently their typings files refer to both node
 * types like `Buffer` (which don't exist in the browser), and browser
 * types like `Blob` (which don't exist in node). Instead of sticking
 * all of `dom` in `compilerOptions.lib`, it suffices just to put in a
 * stub definition of the affected types so that compilation
 * succeeds.
 */

declare type RequestInit = Record<string, unknown>;
declare type ElementTagNameMap = any;
declare type NodeListOf<T> = Record<string, T>;
declare type Node = Record<string, unknown>;
declare type XMLDocument = Record<string, unknown>;
