import { promisify } from "util";
import { gunzip } from "zlib";

/**
 * Promisified version of zlib.gunzip
 */
export const gzipDecode = promisify(gunzip);
