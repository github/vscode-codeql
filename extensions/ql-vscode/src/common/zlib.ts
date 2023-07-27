import { promisify } from "util";
import { gzip, gunzip } from "zlib";

/**
 * Promisified version of zlib.gzip
 */
export const gzipEncode = promisify(gzip);

/**
 * Promisified version of zlib.gunzip
 */
export const gzipDecode = promisify(gunzip);
