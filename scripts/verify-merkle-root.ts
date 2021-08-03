// Copied and modified from https://github.com/Uniswap/merkle-distributor
import { program } from "commander";
import * as fs from "fs";
import { BigNumber, utils } from "ethers";
import { MerkleDistributorInfo, NewFormat } from "../src/parse-balance-map";
import BalanceTree from "../src/balance-tree";

program
  .version("0.0.0")
  .requiredOption(
    "-i, --input <path>",
    "input JSON file location containing the merkle proofs for each account and the merkle root"
  );

program.parse(process.argv);
const options = program.opts();
const json: MerkleDistributorInfo = JSON.parse(
  fs.readFileSync(options.input, { encoding: "utf8" })
);

const combinedHash = (first: Buffer, second: Buffer): Buffer => {
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }

  return Buffer.from(
    utils
      .solidityKeccak256(
        ["bytes32", "bytes32"],
        [first, second].sort(Buffer.compare)
      )
      .slice(2),
    "hex"
  );
};

const toNode = (account: string, amount: string): Buffer => {
  return BalanceTree.toNode(account, amount);
};

const verifyProof = (
  account: string,
  amount: string,
  proof: Buffer[],
  root: Buffer
): boolean => {
  let pair = toNode(account, amount);
  for (const item of proof) {
    pair = combinedHash(pair, item);
  }

  return pair.equals(root);
};

const getNextLayer = (elements: Buffer[]): Buffer[] => {
  return elements.reduce<Buffer[]>((layer, el, idx, arr) => {
    if (idx % 2 === 0) {
      // Hash the current element with its pair element
      layer.push(combinedHash(el, arr[idx + 1]));
    }

    return layer;
  }, []);
};

const getRoot = (balances: NewFormat[]): Buffer => {
  let nodes = balances
    .map(({ account, amount }) => toNode(account, amount))
    // sort by lexicographical order
    .sort(Buffer.compare);

  // deduplicate any eleents
  nodes = nodes.filter((el, idx) => {
    return idx === 0 || !nodes[idx - 1].equals(el);
  });

  const layers = [];
  layers.push(nodes);

  // Get next layer until we reach the root
  while (layers[layers.length - 1].length > 1) {
    layers.push(getNextLayer(layers[layers.length - 1]));
  }

  return layers[layers.length - 1][0];
};

if (typeof json !== "object") throw new Error("Invalid JSON");

const merkleRootHex = json.merkleRoot;
const merkleRoot = Buffer.from(merkleRootHex.slice(2), "hex");

let balances: NewFormat[] = [];
let valid = true;

Object.keys(json.recipients).forEach((address) => {
  const claim = json.recipients[address];
  const proof = claim.proof.map((p: string) => Buffer.from(p.slice(2), "hex"));
  balances.push({ account: address, amount: claim.amount });
  if (verifyProof(address, claim.amount, proof, merkleRoot)) {
    console.log("Verified proof for", address, claim.amount);
  } else {
    console.log("Verification for", address, claim.amount, "failed");
    valid = false;
  }
});

if (!valid) {
  console.error("Failed validation for 1 or more proofs");
  process.exit(1);
}
console.log("Done!");

// Root
const root = getRoot(balances).toString("hex");
console.log("Reconstructed merkle root", root);
let doesRootMatch = root === merkleRootHex.slice(2);
console.log("Root matches the one read from the JSON?", doesRootMatch);

if (!doesRootMatch) {
  console.error(
    `Root did not match the one from the JSON. \nGiven: ${root} Expected: ${merkleRootHex.slice(
      2
    )}`
  );
  process.exit(1);
}
