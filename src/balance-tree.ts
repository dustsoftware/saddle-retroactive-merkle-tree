// Copied and modified from https://github.com/Uniswap/merkle-distributor

import MerkleTree from "./merkle-tree";
import { BigNumber, utils } from "ethers";
import { NewFormat } from "./parse-balance-map";

export default class BalanceTree {
  private readonly tree: MerkleTree;
  constructor(balances: NewFormat[]) {
    this.tree = new MerkleTree(
      balances.map(({ account, amount }) => {
        return BalanceTree.toNode(account, amount);
      })
    );
  }

  public static verifyProof(
    index: number | BigNumber,
    account: string,
    amount: string,
    proof: Buffer[],
    root: Buffer
  ): boolean {
    let pair = BalanceTree.toNode(account, amount);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair.equals(root);
  }

  // keccak256(abi.encode(account))
  public static toNode(account: string, amount: string): Buffer {
    return Buffer.from(
      utils
        .solidityKeccak256(["address", "uint256"], [account, amount])
        .substr(2),
      "hex"
    );
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  // returns the hex bytes32 values of the proof
  public getProof(account: string, amount: string): string[] {
    return this.tree.getHexProof(BalanceTree.toNode(account, amount));
  }
}
