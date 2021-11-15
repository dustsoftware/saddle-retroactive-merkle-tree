// Copied and modified from https://github.com/Uniswap/merkle-distributor

import { program } from "commander";
import * as fs from "fs-extra";
import { parseBalanceMap } from "../src/parse-balance-map";

program
  .version("0.0.0")
  .requiredOption(
    "-i, --input <path>",
    "input JSON file location containing a map of account addresses to string balances"
  )
  .option(
    "-o --output <path>",
    "file path for the generated output of merkle tree data"
  );

program.parse(process.argv);
const options = program.opts();

const json = JSON.parse(fs.readFileSync(options.input, { encoding: "utf8" }));
if (typeof json !== "object") throw new Error("Invalid JSON");

const merkleTreeInfo = parseBalanceMap(json);

let path = `output/results-${Date.now()}.json`;
if (options.output) {
  path = options.output;
}

// const formattedOutput = JSON.stringify(merkleTreeInfo, null, 4);

fs.outputJson(path, merkleTreeInfo, (err) => {
  if (err) {
    console.log(err);
  }
})
