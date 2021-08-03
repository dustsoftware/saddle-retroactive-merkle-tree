// Copied and modified from https://github.com/Uniswap/merkle-distributor

import { BigNumber, utils } from "ethers";
import BalanceTree from "./balance-tree";

const { isAddress, getAddress } = utils;

// This is the blob that gets distributed and pinned to IPFS.
// It is completely sufficient for recreating the entire merkle tree.
// Anyone can verify that all air drops are included in the tree,
// and the tree has no additional distributions.
export interface MerkleDistributorInfo {
  merkleRoot: string;
  recipients: {
    [account: string]: {
      amount: string;
      proof: string[];
    };
  };
}

interface InputFormat {
  [account: string]: string;
}
export interface NewFormat {
  account: string;
  amount: string;
}

export function parseBalanceMap(balances: InputFormat): MerkleDistributorInfo {
  // if balances are in an old format, process them
  const balancesInNewFormat: NewFormat[] = Object.keys(balances).map(
    (account): NewFormat => ({
      account,
      amount: balances[account],
    })
  );

  const sortedBalances = balancesInNewFormat
    .sort((a, b) => (a.account > b.account ? 1 : -1))
    .map((obj) => ({
      account: getAddress(obj.account),
      amount: obj.amount,
    }));

  // construct a tree
  const tree = new BalanceTree(sortedBalances);

  // generate allowedAccounts
  const recipients = sortedBalances.reduce<{
    [address: string]: {
      amount: string;
      proof: string[];
    };
  }>((memo, balance, index) => {
    memo[balance.account] = {
      amount: balance.amount,
      proof: tree.getProof(balance.account, balance.amount),
    };
    return memo;
  }, {});

  return {
    merkleRoot: tree.getHexRoot(),
    recipients,
  };
}
