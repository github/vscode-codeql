import * as Sarif from 'sarif';
import * as fs from 'fs-extra';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import Assembler = require('stream-json/Assembler');
import { chain } from 'stream-chain';

const DUMMY_TOOL : Sarif.Tool = {driver: {name: ''}};

export async function sarifParser(interpretedResultsPath: string) : Promise<Sarif.Log> {
  try {
    // Parse the SARIF file into token streams, filtering out only the results array.
    const p = parser();
    const pipeline = chain([
      fs.createReadStream(interpretedResultsPath),
      p,
      pick({filter: 'runs.0.results'})
    ]);

    // Creates JavaScript objects from the token stream
    const asm = Assembler.connectTo(pipeline);

    // Returns a constructed Log object with the results or an empty array if no results were found.
    // If the parser fails for any reason, it will reject the promise.
    return await new Promise((resolve, reject) => {
      pipeline.on('error', (error) => {
        reject(error);
      });
      
      asm.on('done', (asm) => {

        const log : Sarif.Log = {
          version: '2.1.0', 
          runs: [
            { 
              tool: DUMMY_TOOL, 
              results: asm.current ?? []
            }
          ]
        };
        
        resolve(log);
      });
    });
  } catch (err) {
    throw new Error(`Parsing output of interpretation failed: ${err.stderr || err}`);
  }
}