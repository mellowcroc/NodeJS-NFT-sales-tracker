import express, { Request, Response, NextFunction } from "express";
import { BigNumber, Contract, ethers, utils } from "ethers";
import "dotenv/config";
import osAbiMaticChain from "./utils/osAbiMaticChain.json";
import osAbiEthChain from "./utils/osAbiEthChain.json";
import erc20Abi from "./utils/erc20Abi.json";
import InputDataDecoder from "ethereum-input-data-decoder";
import TwitterApi from "twitter-api-v2";
import { formatEther, formatUnits, parseEther } from "ethers/lib/utils";

const app = express();

const maticProvider = new ethers.providers.AlchemyProvider(
  "matic",
  "WOoOVulx3jcn_plLu_rMKYXbBGX-BRvG"
);
const ethProvider = new ethers.providers.AlchemyProvider(
  "homestead",
  "WOoOVulx3jcn_plLu_rMKYXbBGX-BRvG"
);
const transferHash = utils.id("Transfer(address,address,uint256)");
const davaAddress = "0xf81cb9bfea10d94801f3e445d3d818e72e8d1da4";
const otherSideAddress = "0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258";
const osAddressMaticChain = "0xf715beb51ec8f63317d66f491e37e7bb048fcc2d";

const client = new TwitterApi({
  appKey: process.env.APP_KEY!,
  appSecret: process.env.APP_SECRET!,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

function tweet(message: string) {
  client.v1
    .tweet(message)
    .then((val) => {
      console.log(val);
      console.log("success");
    })
    .catch((err) => {
      console.log(err);
    });
}

async function davaListen() {
  const transferFilter = {
    address: davaAddress,
    topics: [transferHash],
  };
  maticProvider.on(transferFilter, async (event) => {
    // console.log(event);
    const tokenId = BigNumber.from(event.topics[3]).toNumber();
    const tx = await maticProvider.getTransaction(event.transactionHash);
    console.log("DAVA TX: ", tx.hash);
    if (tx.to && tx.to.toLowerCase() === osAddressMaticChain) {
      console.log("DAVA 1");
      const decoder = new InputDataDecoder(osAbiMaticChain);
      const result = decoder.decodeData(tx.data);
      console.log(result);
      if (result.method === "matchOrders") {
        console.log("DAVA 2");
        const from = result.inputs[0][0];
        const to = result.inputs[1][0];
        const bidAmount = result.inputs[0][4];
        const bidTokenAddress = result.inputs[3];
        const bidTokenContract = new ethers.Contract(
          bidTokenAddress,
          JSON.stringify(erc20Abi),
          ethProvider
        );
        const symbol = await bidTokenContract.symbol();
        const decimals = await bidTokenContract.decimals();

        console.log("from: ", from);
        console.log("to: ", to);
        tweet(
          "Dava #" +
          tokenId +
          " bought for " +
          formatUnits(bidAmount, decimals) +
          " " +
          symbol +
          "!"
        );
      }
    }
  });
}

function othersideListen() {
  const filter = {
    address: otherSideAddress,
    topics: [transferHash],
  };
  ethProvider.on(filter, async (event) => {
    // console.log(event);
    const tokenId = BigNumber.from(event.topics[3]).toNumber();
    const tx = await ethProvider.getTransaction(event.transactionHash);
    console.log("OTHERSIDE TX: ", tx.hash);
    if (tx.to?.toLowerCase() === "0x7f268357a8c2552623316e2562d90e642bb538e5") {
      console.log("OTHERSIDE 1");
      const decoder = new InputDataDecoder(osAbiEthChain);
      const result = decoder.decodeData(tx.data);
      if (result.method === "atomicMatch_") {
        console.log("OTHERSIDE 2");
        const bidTokenAddress = result.inputs[0][6];
        const bidAmount = result.inputs[1][4];

        if (bidTokenAddress !== "0x0000000000000000000000000000000000000000") {
          console.log("OTHERSIDE 3");
          const bidTokenContract = new ethers.Contract(
            bidTokenAddress,
            JSON.stringify(erc20Abi),
            ethProvider
          );
          const symbol = await bidTokenContract.symbol();
          const decimals = await bidTokenContract.decimals();
          tweet(
            "Otherside #" +
            tokenId +
            " bought for " +
            formatUnits(bidAmount, decimals) +
            " " +
            symbol +
            "!"
          );
        } else {
          tweet(
            "Otherside #" +
            tokenId +
            " bought for " +
            formatEther(tx.value) +
            " ETH!"
          );
        }
      }
    }
  });
}

davaListen();
othersideListen();
