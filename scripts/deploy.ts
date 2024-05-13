import { ethers } from "hardhat";

async function main() {
  const liqWallet = "0x82adc5C5624D5fa7902CAA307aDefeE307B3f37e";
  const marketWallet = "0x82adc5C5624D5fa7902CAA307aDefeE307B3f37e";
  const devWallet = "0x82adc5C5624D5fa7902CAA307aDefeE307B3f37e";
  const justbelieve = await ethers.getContractFactory("LuckyCatoshiToken");

  const believe = await justbelieve.deploy(liqWallet, marketWallet, devWallet);
  await believe.waitForDeployment();

  const address = await believe.getAddress();
  console.log(address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
