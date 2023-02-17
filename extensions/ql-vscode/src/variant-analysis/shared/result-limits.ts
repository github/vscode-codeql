// The maximum number of raw results to read from a BQRS file.
// This is used to avoid reading the entire result set into memory
// and trying to render it on screen. Users will be warned if the
// results are capped.
export const MAX_RAW_RESULTS = 500;
