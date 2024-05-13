import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { formatUnits, parseUnits } from "ethers";
import { format } from "node:path/win32";
import { parse } from "node:path";
import { IERC20 } from "../typechain-types/contracts/uniswapV2.sol/IERC20";
import { IERC20__factory } from "../typechain-types/factories/contracts/uniswapV2.sol";

const addr0 = "0x0000000000000000000000000000000000000000";

describe("Uniswap", function () {
  async function deployFixture() {
    const [owner, addr1, addr2, pairAddr, liq, dev, market] =
      await hre.ethers.getSigners();
    const uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const Catoshi = await hre.ethers.getContractFactory("LuckyCatoshiToken");
    const catoshi = await Catoshi.deploy(
      liq.address,
      market.address,
      dev.address,
      {
        maxFeePerGas: 33000000000,
      }
    );
    const catoshiAddress = await catoshi.getAddress();
    const decimals = await catoshi.decimals();

    const domainData = {
      name: "Lucky Catoshi",
      version: "1",
      chainId: hre.network.config.chainId as number,
      verifyingContract: catoshiAddress,
      salt: null,
    };

    const UniswapV2Factory = await hre.ethers.getContractFactory(
      "UniswapV2Mock"
    );
    const uniswapV2 = await UniswapV2Factory.deploy(catoshiAddress, {
      maxFeePerGas: 33000000000,
    });
    const uniswapV2Address = await uniswapV2.getAddress();

    const wethAddress = await uniswapV2.ethAddress();
    const wethContract = new hre.ethers.Contract(
      wethAddress,
      IERC20__factory.abi,
      addr2
    ) as any as IERC20;

    return {
      owner,
      addr1,
      addr2,
      pairAddr,
      liq,
      dev,
      market,
      catoshi,
      catoshiAddress,
      domainData,
      decimals,
      uniswapV2,
      uniswapV2Address,
      wethAddress,
      wethContract,
    };
  }

  describe("Deployment", function () {
    it("Should have correct initial configuration", async function () {
      const { catoshi, catoshiAddress, decimals, owner, liq, uniswapV2 } =
        await loadFixture(deployFixture);

      expect(await catoshi.name()).to.equal("Lucky Catoshi");
      expect(await catoshi.symbol()).to.equal("LUCK");

      const totalSupply = await catoshi.totalSupply();
      expect(totalSupply).to.equal(parseUnits("1000000000", decimals));
      expect(await catoshi.owner()).to.equal(owner.address);
      expect(await catoshi.balanceOf(liq.address)).to.equal(
        parseUnits("500000000", decimals)
      );

      expect(await uniswapV2.tokenAddress()).to.equal(catoshiAddress);
    });
  });

  describe("create Pairs", function () {
    it("Should create pairs", async function () {
      const { catoshi, catoshiAddress, owner, uniswapV2, uniswapV2Address } =
        await loadFixture(deployFixture);

      const usdtAddress = await uniswapV2.usdtAddress();
      const wethAddress = await uniswapV2.ethAddress();

      await uniswapV2.createSwapPair();

      const pairCatoshiUsdt = await uniswapV2.swapPairsMap("usdt");
      const pairCatoshiWeth = await uniswapV2.swapPairsMap("weth");

      expect(pairCatoshiUsdt).to.not.equal(addr0);
      expect(pairCatoshiWeth).to.not.equal(addr0);
    });

    it("Should add liquidity", async function () {
      const {
        catoshi,
        catoshiAddress,
        owner,
        liq,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("500000000", decimals));
      // send some eth to uniswapV2mock to let it be the liquidity provider
      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      // grant all access to uniswapV2mock to enable it to transfer tokens before launch
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      const pairInfo = await uniswapV2.pairInfo(catoshiAddress, wethAddress);
      expect(pairInfo[0]).to.equal(parseUnits("250000000", decimals));
      expect(pairInfo[1]).to.equal(parseUnits("1000", decimals));
    });

    it("Should swap eth to token", async function () {
      const {
        catoshi,
        catoshiAddress,
        owner,
        liq,
        addr2,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("500000000", decimals));
      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      await catoshi.setLaunch();

      await wethContract
        .connect(addr2)
        .deposit({ value: parseUnits("5", decimals) });

      await wethContract
        .connect(addr2)
        .approve(uniswapV2Address, parseUnits("5", decimals));

      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const timestamp = (await hre.ethers.provider.getBlock(latestBlock))!
        .timestamp;
      await uniswapV2
        .connect(addr2)
        .swap(
          wethAddress,
          catoshiAddress,
          parseUnits("5", decimals),
          addr2.address,
          timestamp + 1000
        );

      expect(await catoshi.balanceOf(addr2.address)).to.greaterThan(0);
      expect(await hre.ethers.provider.getBalance(addr2.address)).to.lessThan(
        parseUnits("9995", decimals)
      );
    });

    it("Should transfer after set tx limit", async function () {
      const {
        catoshi,
        catoshiAddress,
        liq,
        market,
        addr2,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("500000000", decimals));
      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      await catoshi.setLaunch();
      await catoshi.setMaxTxLimit(true, parseUnits("100000000", decimals));

      await catoshi
        .connect(market)
        .transfer(uniswapV2Address, parseUnits("110000000", decimals));

      expect(await catoshi.balanceOf(market.address)).to.equal(
        parseUnits("340000000", decimals)
      );
    });

    it("Should fail if swap eth to token over tx limit", async function () {
      const {
        catoshi,
        catoshiAddress,
        liq,
        addr2,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("500000000", decimals));
      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      await catoshi.setLaunch();
      await catoshi.setMaxTxLimit(true, parseUnits("100000000", decimals));

      await wethContract
        .connect(addr2)
        .deposit({ value: parseUnits("1000", decimals) });

      await wethContract
        .connect(addr2)
        .approve(uniswapV2Address, parseUnits("1000", decimals));

      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const timestamp = (await hre.ethers.provider.getBlock(latestBlock))!
        .timestamp;
      await expect(
        uniswapV2
          .connect(addr2)
          .swap(
            wethAddress,
            catoshiAddress,
            parseUnits("1000", decimals),
            addr2.address,
            timestamp + 1000
          )
      ).to.be.revertedWith("UniswapV2: TRANSFER_FAILED");
    });

    it("Should swap tokens to eth", async function () {
      const {
        catoshi,
        catoshiAddress,
        owner,
        liq,
        addr2,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("400000000", decimals));

      await catoshi
        .connect(liq)
        .transfer(addr2.address, parseUnits("10000", decimals));

      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      await catoshi.setLaunch();

      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const timestamp = (await hre.ethers.provider.getBlock(latestBlock))!
        .timestamp;

      const tokenBalance = await catoshi.balanceOf(addr2.address);
      const ethBalance = await hre.ethers.provider.getBalance(addr2.address);

      await catoshi.connect(addr2).approve(uniswapV2Address, tokenBalance);
      await uniswapV2
        .connect(addr2)
        .swap(
          catoshiAddress,
          wethAddress,
          tokenBalance,
          addr2.address,
          timestamp + 1000
        );

      const wethBalance = await wethContract.balanceOf(addr2.address);
      await wethContract.connect(addr2).withdraw(wethBalance);
      const tokenBalance2 = await catoshi.balanceOf(addr2.address);
      const ethBalance2 = await hre.ethers.provider.getBalance(addr2.address);
      expect(tokenBalance2).to.equal(0);
      expect(ethBalance2).to.greaterThan(ethBalance);
    });

    it("Should swap over tx limit even if not limit", async function () {
      const {
        catoshi,
        catoshiAddress,
        liq,
        market,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("500000000", decimals));

      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      await catoshi.setLaunch();
      await catoshi.setMaxTxLimit(true, parseUnits("100000000", decimals));
      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const timestamp = (await hre.ethers.provider.getBlock(latestBlock))!
        .timestamp;

      await catoshi
        .connect(market)
        .approve(uniswapV2Address, parseUnits("110000000", decimals));
      await expect(
        uniswapV2
          .connect(market)
          .swap(
            catoshiAddress,
            wethAddress,
            parseUnits("110000000", decimals),
            market.address,
            timestamp + 1000
          )
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("Should fail if swap over tx limit", async function () {
      const {
        catoshi,
        catoshiAddress,
        owner,
        liq,
        addr2,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("300000000", decimals));

      await catoshi
        .connect(liq)
        .transfer(addr2.address, parseUnits("110000000", decimals));

      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      await catoshi.setLaunch();

      await catoshi.setMaxTxLimit(true, parseUnits("100000000", decimals));

      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const timestamp = (await hre.ethers.provider.getBlock(latestBlock))!
        .timestamp;

      const tokenBalance = await catoshi.balanceOf(addr2.address);
      await catoshi.connect(addr2).approve(uniswapV2Address, tokenBalance);
      await expect(
        uniswapV2
          .connect(addr2)
          .swap(
            catoshiAddress,
            wethAddress,
            tokenBalance,
            addr2.address,
            timestamp + 1000
          )
      ).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("Should fail if in blacklist", async function () {
      const {
        catoshi,
        catoshiAddress,
        owner,
        liq,
        addr2,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("300000000", decimals));

      await catoshi
        .connect(liq)
        .transfer(addr2.address, parseUnits("110000000", decimals));

      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      await catoshi.setLaunch();

      await catoshi.setMaxTxLimit(true, parseUnits("100000000", decimals));

      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const timestamp = (await hre.ethers.provider.getBlock(latestBlock))!
        .timestamp;

      const tokenBalance = await catoshi.balanceOf(addr2.address);

      await catoshi.setBlacklist(addr2.address, true);

      await catoshi.connect(addr2).approve(uniswapV2Address, tokenBalance);
      await expect(
        uniswapV2
          .connect(addr2)
          .swap(
            catoshiAddress,
            wethAddress,
            tokenBalance,
            addr2.address,
            timestamp + 1000
          )
      ).revertedWithCustomError(catoshi, "BlacklistDectected");
    });

    it("Should fail for public if not launched", async function () {
      const {
        catoshi,
        catoshiAddress,
        owner,
        liq,
        addr2,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("500000000", decimals));
      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");

      await wethContract
        .connect(addr2)
        .deposit({ value: parseUnits("5", decimals) });

      await wethContract
        .connect(addr2)
        .approve(uniswapV2Address, parseUnits("5", decimals));

      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const timestamp = (await hre.ethers.provider.getBlock(latestBlock))!
        .timestamp;
      await expect(
        uniswapV2
          .connect(addr2)
          .swap(
            wethAddress,
            catoshiAddress,
            parseUnits("5", decimals),
            addr2.address,
            timestamp + 1000
          )
      ).to.be.revertedWith("UniswapV2: TRANSFER_FAILED");
    });

    it("Should fail if no liquidity", async function () {
      const {
        catoshi,
        catoshiAddress,
        owner,
        liq,
        dev,
        uniswapV2,
        uniswapV2Address,
        decimals,
        wethAddress,
        wethContract,
      } = await loadFixture(deployFixture);

      await catoshi
        .connect(liq)
        .transfer(uniswapV2Address, parseUnits("500000000", decimals));
      await liq.sendTransaction({
        to: uniswapV2Address,
        value: parseUnits("1000", decimals),
      });

      await uniswapV2.createSwapPair();
      await catoshi.grantAllAccess(uniswapV2Address, true);
      const wethPair = await uniswapV2.swapPairsMap("weth");
      await catoshi.addPair(wethPair, true);
      await uniswapV2.addLiquidity("weth");
      const usdtPair = await uniswapV2.swapPairsMap("usdt");

      await catoshi.setLaunch();

      await catoshi
        .connect(dev)
        .approve(uniswapV2Address, parseUnits("5", decimals));

      const latestBlock = await hre.ethers.provider.getBlockNumber();
      const timestamp = (await hre.ethers.provider.getBlock(latestBlock))!
        .timestamp;
      await expect(
        uniswapV2
          .connect(dev)
          .swap(
            catoshiAddress,
            usdtPair,
            parseUnits("5", decimals),
            dev.address,
            timestamp + 1000
          )
      ).to.be.revertedWithoutReason();
    });
  });
});
