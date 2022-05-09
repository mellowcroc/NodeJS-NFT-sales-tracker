import express, { Request, Response, NextFunction } from "express";
import { BigNumber, Contract, ethers, utils } from "ethers";
import { createAlchemyWeb3 } from "@alch/alchemy-web3";
import davaAbi from "./utils/davaAbi.json";
import osAbi from "./utils/osAbi.json";
import genMaskAbi from "./utils/genMaskAbi.json";
import InputDataDecoder from "ethereum-input-data-decoder";
import TwitterApi from "twitter-api-v2";
const { ACCESS_SECRET, ACCESS_TOKEN, APP_KEY, APP_SECRET } = process.env; // here to demo env variables

const app = express();

app.get("/welcome", (req: Request, res: Response, next: NextFunction) => {
  res.send("welcome!");
});

app.get("/callback", (req: Request, res: Response, next: NextFunction) => {
  res.send("callback!");
});

const maticProvider = new ethers.providers.AlchemyProvider(
  "matic",
  "WOoOVulx3jcn_plLu_rMKYXbBGX-BRvG"
);
const ethProvider = new ethers.providers.AlchemyProvider(
  "homestead",
  "WOoOVulx3jcn_plLu_rMKYXbBGX-BRvG"
);

const transferHash = utils.id("Transfer(address,address,uint256)");
const dava = {
  abi: davaAbi,
  address: "0xf81cb9bfea10d94801f3e445d3d818e72e8d1da4",
};

const genMask = {
  abi: genMaskAbi,
  address: "0xfD257dDf743DA7395470Df9a0517a2DFbf66D156",
};

const otherSideAddress = "0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258";
const osAddress = "0xf715beb51ec8f63317d66f491e37e7bb048fcc2d";

const client = new TwitterApi({
  appKey: ACCESS_SECRET!,
  appSecret: ACCESS_TOKEN!,
  accessToken: APP_KEY,
  accessSecret: APP_SECRET,
});

async function davaQuery() {
  client.v1
    .tweet("This tweet was written by a bot")
    .then((val) => {
      console.log(val);
      console.log("success");
    })
    .catch((err) => {
      console.log(err);
    });

  const instance = dava;
  const contract = new Contract(instance.address, instance.abi, maticProvider);

  const transferFilter = {
    address: instance.address,
    topics: [
      transferHash,
      // null,
      // "0x00000000000000000000000096f68c60443093371dc57cafbeb721b4f32bb19c",
    ],
  };
  // @ts-ignore
  const logs = await contract.queryFilter(transferFilter, 0x1a1cdde, 0x1aaf9e4);
  maticProvider.on(transferFilter, async (event) => {
    console.log(event);
  });
  const tx = await maticProvider.getTransaction(
    logs[logs.length - 1].transactionHash
  );
  console.log("tx: ", tx);
  const dataWithoutFunctionSignature =
    "0x" + tx.data.substring(10, tx.data.length);

  if (tx.to && tx.to.toLowerCase() === osAddress) {
    const decoder = new InputDataDecoder(osAbi);
    const result = decoder.decodeData(tx.data);
    console.log(result);
    if (result.method === "matchOrders") {
      console.log(result.method);
      const from = result.inputs[0][0];
      const amount = result.inputs[0][4];
      const to = result.inputs[1][0];
      console.log("from: ", from);
      console.log("amount: ", utils.formatUnits(amount));
      console.log("to: ", to);
    }
  }
  // console.log("JSON.stringify(abi): ", JSON.stringify(abi));

  // const logsFromOS = [];
  // for (let i = 0; i < logs.length / 10; i++) {
  //   const tx = await provider.getTransaction(logs[i].transactionHash);
  //   console.log("tx.to: ", tx.to);
  //   if (tx.to === osAddress) {
  //     logsFromOS.push(logs[i]);
  //   }
  // }

  // console.log("LENGTH: ", logsFromOS.length);
  // console.log("LENGTH: ", logsFromOS[logsFromOS.length - 1]);

  // const block = await provider.getBlock(100005);
  // console.log(block);
}

function othersideListen() {
  const filter = {
    address: otherSideAddress,
    topics: [transferHash],
  };
  ethProvider.on(filter, (event) => {
    console.log("event: ", event);
  });
}

app.listen("1234", () => {
  console.log(`
  ################################################
  🛡️  Server listening on port: 1234🛡️
  ################################################
`);
});
// websocket();
davaQuery();
// othersideListen();
