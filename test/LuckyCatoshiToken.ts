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

describe("Lucky Catoshi ERC20", function () {
  async function deployFixture() {
    const [owner, addr1, addr2, pairAddr, dev, market] =
      await hre.ethers.getSigners();

    const uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const Catoshi = await hre.ethers.getContractFactory("LuckyCatoshiToken");

    const catoshi = await Catoshi.deploy(market.address, dev.address, {
      maxFeePerGas: 33000000000,
    });
    const catoshiAddress = await catoshi.getAddress();
    const decimals = await catoshi.decimals();

    const domainData = {
      name: "Lucky Catoshi",
      version: "1",
      chainId: hre.network.config.chainId as number,
      verifyingContract: catoshiAddress,
      salt: null,
    };

    return {
      owner,
      addr1,
      addr2,
      pairAddr,
      dev,
      market,
      catoshi,
      catoshiAddress,
      domainData,
      decimals,
    };
  }

  describe("Deployment", function () {
    it("Should have correct initial configuration", async function () {
      const { catoshi, decimals, owner, dev, market } = await loadFixture(
        deployFixture
      );

      expect(await catoshi.name()).to.equal("Lucky Catoshi");
      expect(await catoshi.symbol()).to.equal("LUCK");

      const totalSupply = await catoshi.totalSupply();
      expect(totalSupply).to.equal(parseUnits("1000000000", decimals));
      expect(await catoshi.owner()).to.equal(owner.address);
      expect(await catoshi.balanceOf(owner.address)).to.equal(
        parseUnits("750000000", decimals)
      );
      expect(await catoshi.balanceOf(market.address)).to.equal(
        parseUnits("150000000", decimals)
      );
      expect(await catoshi.balanceOf(dev.address)).to.equal(
        parseUnits("100000000", decimals)
      );
      expect(await catoshi.decimals()).to.equal(18);
    });
  });

  describe("Transfer", function () {
    it("Should owner transfer tokens", async function () {
      const { catoshi, owner, addr1, addr2 } = await loadFixture(deployFixture);

      await catoshi.transfer(addr1.address, 1000);
      expect(await catoshi.balanceOf(addr1.address)).to.equal(1000);

      const ownerBalance = await catoshi.balanceOf(owner.address);
      expect(ownerBalance).to.equal("749999999999999999999999000");
    });

    it("Should transfer tokens after launch", async function () {
      const { catoshi, owner, addr1, addr2, pairAddr } = await loadFixture(
        deployFixture
      );

      await catoshi.transfer(addr1.address, 1000);
      await catoshi.setLaunch();

      await catoshi.connect(addr1).transfer(addr2.address, 100);
      expect(await catoshi.balanceOf(addr1.address)).to.equal(900);
      expect(await catoshi.balanceOf(addr2.address)).to.equal(100);
    });

    it("Should fail if not launch", async function () {
      const { catoshi, addr1, addr2 } = await loadFixture(deployFixture);
      await catoshi.transfer(addr1.address, 1000);

      await expect(
        catoshi.connect(addr1).transfer(addr2.address, 100)
      ).to.be.revertedWithCustomError(catoshi, "NotLaunched");
    });

    it("Should fail if not enough token", async function () {
      const { catoshi, addr1, addr2, pairAddr } = await loadFixture(
        deployFixture
      );

      await catoshi.setLaunch();

      await expect(
        catoshi.connect(addr1).transfer(addr2.address, 100)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });
  });

  describe("Burn", function () {
    it("Should burn tokens", async function () {
      const { catoshi, addr1, decimals } = await loadFixture(deployFixture);

      await catoshi.transfer(addr1.address, parseUnits("1", decimals));
      await catoshi.setLaunch();

      await catoshi.burn(parseUnits("1", decimals));
      await catoshi.connect(addr1).burn(parseUnits("1", decimals));
      expect(await catoshi.balanceOf(addr1.address)).to.equal(0);
      expect(await catoshi.totalSupply()).to.equal(
        parseUnits("999999998", decimals)
      );
    });
  });

  describe("Slot Machine", function () {
    function getSlotMessage(player: string, slot: number) {
      const typesData = {
        ClaimSlotPrize: [
          { name: "player", type: "address" },
          { name: "slot", type: "uint16" },
        ],
      };

      const messageData = {
        player,
        slot,
      };

      return { claimTypes: typesData, claimData: messageData };
    }
    it("Should claim prize", async function () {
      const { catoshi, addr1, market, domainData, decimals } =
        await loadFixture(deployFixture);
      await catoshi.setSlotPrize(777, parseUnits("1000", decimals));
      await catoshi.setLaunch();

      const { claimTypes, claimData } = getSlotMessage(addr1.address, 777);
      const signature = await market.signTypedData(
        domainData,
        claimTypes,
        claimData
      );
      await catoshi.connect(market).claimSlotPrize(addr1, 777, signature);
      expect(await catoshi.balanceOf(addr1.address)).to.equal(
        parseUnits("1000", decimals)
      );
      expect(await catoshi.balanceOf(market.address)).to.equal(
        parseUnits("149999000", decimals)
      );
    });

    it("Should fail if wrong sender", async function () {
      const { catoshi, owner, addr1, market, domainData, decimals } =
        await loadFixture(deployFixture);
      await catoshi.setSlotPrize(777, parseUnits("1000", decimals));
      await catoshi.setLaunch();

      const { claimTypes, claimData } = getSlotMessage(addr1.address, 777);
      const signature = await market.signTypedData(
        domainData,
        claimTypes,
        claimData
      );
      await expect(
        catoshi.connect(owner).claimSlotPrize(addr1, 777, signature)
      ).to.be.revertedWithCustomError(catoshi, "InvalidMsgSender");
    });

    it("Should fail if invalid signature", async function () {
      const { catoshi, owner, addr1, market, domainData, decimals } =
        await loadFixture(deployFixture);
      await catoshi.setSlotPrize(777, parseUnits("1000", decimals));
      await catoshi.setLaunch();

      const { claimTypes, claimData } = getSlotMessage(addr1.address, 77);
      const signature = await market.signTypedData(
        domainData,
        claimTypes,
        claimData
      );
      await expect(
        catoshi.connect(market).claimSlotPrize(addr1, 777, signature)
      ).to.be.revertedWithCustomError(catoshi, "InvalidSignature");
    });
  });

  describe("Aridop", function () {
    it("Should aridop", async function () {
      const { catoshi, owner, addr1, addr2, market, pairAddr } =
        await loadFixture(deployFixture);

      await catoshi
        .connect(market)
        .airdrop([addr1.address, addr2.address], [1000, 500]);

      expect(await catoshi.balanceOf(addr1.address)).to.equal(1000);
      expect(await catoshi.balanceOf(addr2.address)).to.equal(500);
    });

    it("Should fail with wrong sender", async function () {
      const { catoshi, owner, addr1, addr2, market, pairAddr } =
        await loadFixture(deployFixture);

      await expect(
        catoshi.airdrop([addr1.address, addr2.address], [1000, 500])
      ).to.be.revertedWithCustomError(catoshi, "InvalidMsgSender");
    });
  });
});
