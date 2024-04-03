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

    const Catoshi = await hre.ethers.getContractFactory("LuckyCatoshiToken");
    const catoshi = await Catoshi.deploy(market.address, dev.address);
    const catoshiAddress = await catoshi.getAddress();

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
    };
  }

  describe("Deployment", function () {
    it("Should have correct initial configuration", async function () {
      const { catoshi, catoshiAddress, owner, dev, market } = await loadFixture(
        deployFixture
      );

      expect(await catoshi.name()).to.equal("Lucky Catoshi");
      expect(await catoshi.symbol()).to.equal("LUCK");

      const totalSupply = await catoshi.totalSupply();
      expect(totalSupply).to.equal(parseUnits("1000000000", 9));
      expect(await catoshi.owner()).to.equal(owner.address);
      expect(await catoshi.balanceOf(owner.address)).to.equal(
        parseUnits("760000000", 9)
      );
      expect(await catoshi.balanceOf(market.address)).to.equal(
        parseUnits("180000000", 9)
      );
      expect(await catoshi.balanceOf(dev.address)).to.equal(
        parseUnits("60000000", 9)
      );
      expect(await catoshi.decimals()).to.equal(9);
    });
  });

  describe("Transfer", function () {
    it("Should owner transfer tokens", async function () {
      const { catoshi, owner, addr1, addr2 } = await loadFixture(deployFixture);

      await catoshi.transfer(addr1.address, 1000);
      expect(await catoshi.balanceOf(addr1.address)).to.equal(1000);

      const ownerBalance = await catoshi.balanceOf(owner.address);
      expect(ownerBalance).to.equal("759999999999999000");
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
      const { catoshi, owner, addr1, pairAddr } = await loadFixture(
        deployFixture
      );

      await catoshi.transfer(addr1.address, parseUnits("1", 9));
      await catoshi.setLaunch();

      await catoshi.burn(parseUnits("1", 9));
      await catoshi.connect(addr1).burn(parseUnits("1", 9));
      expect(await catoshi.balanceOf(addr1.address)).to.equal(0);
      expect(await catoshi.totalSupply()).to.equal(parseUnits("999999998", 9));
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
    it("Should burn tokens", async function () {
      const { catoshi, addr1, market, domainData } = await loadFixture(
        deployFixture
      );
      await catoshi.setSlotPrize(777, parseUnits("1000", 9));
      await catoshi.setLaunch();

      const { claimTypes, claimData } = getSlotMessage(addr1.address, 777);
      const signature = await market.signTypedData(
        domainData,
        claimTypes,
        claimData
      );
      await catoshi.connect(addr1).claimSlotPrize(777, signature);
      expect(await catoshi.balanceOf(addr1.address)).to.equal(
        parseUnits("1000", 9)
      );
      expect(await catoshi.balanceOf(market.address)).to.equal(
        parseUnits("179999000", 9)
      );
    });
  });
});
