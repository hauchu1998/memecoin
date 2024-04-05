// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

error NotLaunched();
error InvalidInput();
error BlacklistDectected();
error InvalidBalanceOf(address account);
error InvalidSwapAmountConfig();
error InvalidFeeConfig();
error InvalidTxAmount();
error InvalidWalletAmount();
error InvalidSignature();
error InvalidMsgSender();

contract LuckyCatoshiToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    address public marketingWallet;
    address public devWallet;

    address DEAD = 0x000000000000000000000000000000000000dEaD;
    address ZERO = 0x0000000000000000000000000000000000000000;

    string private _name = "Lucky Catoshi";
    string private _symbol = "LUCK";
    bool public launched;

    bytes32 private constant CLAIM_PRIZE_TYPEHASH =
        keccak256("ClaimSlotPrize(address player,uint16 slot)");

    mapping(address => bool) public isTxLimitExempt;
    mapping(address => bool) public blacklists;
    mapping(uint16 => uint256) public slotPrizes;

    event Launch();
    event AdminGranted(address indexed account, bool isAdmin);
    event BlackList(address indexed blackListed, bool value);
    event SetMarketPair(address indexed pair, bool value);
    event SetSlotPrize(uint16 indexed slot, uint256 prize);
    event ClaimSlotPrize(
        uint16 indexed slot,
        address indexed player,
        uint256 prize
    );

    constructor(
        address _marketWallet,
        address _devWallet
    ) Ownable() ERC20(_name, _symbol) ERC20Permit(_name) {
        marketingWallet = _marketWallet;
        devWallet = _devWallet;

        isTxLimitExempt[DEAD] = true;
        isTxLimitExempt[ZERO] = true;
        isTxLimitExempt[owner()] = true;
        isTxLimitExempt[address(this)] = true;
        isTxLimitExempt[_marketWallet] = true;
        isTxLimitExempt[_devWallet] = true;

        uint256 _totalSupply = 1_000_000_000 ether; // 1B
        _mint(marketingWallet, _totalSupply.mul(15).div(100)); // 15%, for airdrop, marketing
        _mint(devWallet, _totalSupply.mul(10).div(100)); // 10%, for CEX, dev team, burns
        _mint(owner(), _totalSupply.mul(75).div(100)); // 75%, for liquidity
    }

    function setBlacklist(
        address _address,
        bool _isBlacklisting
    ) external onlyOwner {
        blacklists[_address] = _isBlacklisting;
        emit BlackList(_address, _isBlacklisting);
    }

    function setLaunch() external onlyOwner {
        launched = true;
        emit Launch();
    }

    function setSlotPrize(uint16 slot, uint256 prize) external onlyOwner {
        slotPrizes[slot] = prize;
        emit SetSlotPrize(slot, prize);
    }

    function grantAllAccess(address account, bool value) external onlyOwner {
        _grantAllAccess(account, value);
    }

    function transferToAddressETH(
        address payable recipient,
        uint256 amount
    ) private {
        recipient.transfer(amount);
    }

    //to recieve ETH from uniswapV2Router when swaping
    receive() external payable {}

    // airdrop from mint token or minted token
    function airdrop(
        address[] memory _addresses,
        uint256[] memory _amounts,
        uint256 _totalAmount
    ) external onlyOwner {
        if (balanceOf(msg.sender) < _totalAmount)
            revert InvalidBalanceOf(msg.sender);

        if (_addresses.length != _amounts.length) revert InvalidInput();

        for (uint256 i = 0; i < _addresses.length; i++) {
            _transfer(msg.sender, _addresses[i], _amounts[i]);
        }
    }

    // prob need signedDataType for slot machine game to claim reward.
    function claimSlotPrize(
        address player,
        uint16 _slot,
        bytes calldata _signedData
    ) external {
        if (msg.sender != marketingWallet) revert InvalidMsgSender();

        bytes32 _digest = _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_PRIZE_TYPEHASH, player, _slot))
        );

        if (ECDSA.recover(_digest, _signedData) != marketingWallet) {
            revert InvalidSignature();
        }

        uint256 prize = slotPrizes[_slot];
        if (prize > 0) {
            transfer(player, prize);
            emit ClaimSlotPrize(_slot, player, prize);
        }
    }

    function verifySignature(
        uint16 _slot,
        bytes calldata _signedData
    ) external view returns (address player) {
        bytes32 _digest = _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_PRIZE_TYPEHASH, msg.sender, _slot))
        );
        player = ECDSA.recover(_digest, _signedData);
    }

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        amount = amount;
        if (!launched && !isTxLimitExempt[from] && !isTxLimitExempt[to])
            revert NotLaunched();

        if (blacklists[from] || blacklists[to]) revert BlacklistDectected();
    }

    function _grantAllAccess(address account, bool value) internal virtual {
        isTxLimitExempt[account] = value;
        emit AdminGranted(account, value);
    }
}
