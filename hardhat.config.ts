import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
      {
        version: "0.6.6",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/ZZf5XSGkWknONbRlieQuaohaFuPUGoy5",
        // url: "https://mainnet.infura.io/v3/9c57f4f3bbc44000a5561caa817bfff3",
        blockNumber: 19591554,
      },
      gas: "auto",
      gasPrice: "auto",
      initialBaseFeePerGas: 30924770965,
    },
  },
};

export default config;
