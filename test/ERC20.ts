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
    const [owner, addr1, addr2, pairAddr] = await hre.ethers.getSigners();

    const Catoshi = await hre.ethers.getContractFactory("LuckyCatoshiToken");
    const catoshi = await Catoshi.deploy();
    const catoshiAddress = catoshi.getAddress();

    return { owner, addr1, addr2, pairAddr, catoshi, catoshiAddress };
  }

  describe("Deployment", function () {
    it("Should have correct initial configuration", async function () {
      const { catoshi, catoshiAddress, owner } = await loadFixture(
        deployFixture
      );

      expect(await catoshi.name()).to.equal("Lucky Catoshi");
      expect(await catoshi.symbol()).to.equal("LUCK");

      const totalSupply = await catoshi.totalSupply();
      expect(totalSupply).to.equal(parseUnits("1000000000", 9));
      expect(await catoshi.owner()).to.equal(owner.address);
      expect(await catoshi.balanceOf(owner.address)).to.equal(totalSupply);
      expect(await catoshi.decimals()).to.equal(9);
    });
  });

  describe("Transfer", function () {
    it("Should owner transfer tokens", async function () {
      const { catoshi, owner, addr1, addr2 } = await loadFixture(deployFixture);

      await catoshi.transfer(addr1.address, 1000);
      expect(await catoshi.balanceOf(addr1.address)).to.equal(1000);

      const ownerBalance = await catoshi.balanceOf(owner.address);
      expect(ownerBalance).to.equal("999999999999999000");
    });

    it("Should transfer tokens after launch", async function () {
      const { catoshi, owner, addr1, addr2, pairAddr } = await loadFixture(
        deployFixture
      );

      await catoshi.transfer(addr1.address, 1000);
      await catoshi.addSwapPair(pairAddr);

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

      await catoshi.addSwapPair(pairAddr);

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
      await catoshi.addSwapPair(pairAddr);

      await catoshi.burn(parseUnits("1", 9));
      await catoshi.connect(addr1).burn(parseUnits("1", 9));
      expect(await catoshi.balanceOf(addr1.address)).to.equal(0);
      expect(await catoshi.totalSupply()).to.equal(parseUnits("999999998", 9));
    });
  });
});
