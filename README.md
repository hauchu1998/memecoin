# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```

### Steps

1. deploy: npm hardhat run scripts/deploy.ts --network base-mainnet
2. verify: npm hardhat verify --contract <contract> --network base-mainnet <contract address> <parameters>
3. Airdrop and transfer token to corresponding wallet
4. set max transaction limit
5. add liquidity, uniswap v2
   - x $LUCK
   - y $USDC
6. get pair address from base uniswap v2 factory, https://basescan.org/address/0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6#readContract
   - token1 address:
   - token2 address:
7. set pair address in the contract
8. set launch
