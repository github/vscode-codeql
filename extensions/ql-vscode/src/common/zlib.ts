import { gzip, gunzip, InputType as ZlibInputType, ZlibOptions } from "zlib";

/**
 * Promisified version of zlib.gzip
 * @param buffer Buffer to compress
 * @param options zlib options
 */
export function gzipEncode(
  buffer: ZlibInputType,
  options: ZlibOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    gzip(buffer, options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

/**
 * Promisified version of zlib.gunzip
 * @param buffer Buffer to decompress
 * @param options zlib options
 */
export function gzipDecode(
  buffer: ZlibInputType,
  options: ZlibOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    gunzip(buffer, options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}
