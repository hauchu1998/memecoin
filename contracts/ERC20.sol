// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error NotLaunched();
error InvalidInput();
error BlacklistDectected();
error InvalidBalanceOf(address account);
error InvalidSwapAmountConfig();
error InvalidFeeConfig();
error InvalidTxAmount();
error InvalidWalletAmount();

contract LuckyCatoshiToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    address public marketingWallet = 0xd1665Cc71Df93b8E5eb9D4750eE6BDd7f14C7841;
    address public devWallet = 0xd1665Cc71Df93b8E5eb9D4750eE6BDd7f14C7841;

    address DEAD = 0x000000000000000000000000000000000000dEaD;
    address ZERO = 0x0000000000000000000000000000000000000000;

    string private _name = "Lucky Catoshi";
    string private _symbol = "LUCK";
    uint8 private _decimals = 9;
    bool public launched;

    bool public limited;
    uint256 public minHoldingAmount = 0;
    uint256 public maxHoldingAmount = 0;

    mapping(address => bool) public isTxLimitExempt;
    mapping(address => bool) public isMarketPair;
    mapping(address => bool) public blacklists;

    event Launch();
    event AdminGranted(address indexed account, bool isAdmin);

    bool public swapping;
    modifier onlySwapping() {
        swapping = true;
        _;
        swapping = false;
    }

    constructor() Ownable() ERC20(_name, _symbol) ERC20Permit(_name) {
        isTxLimitExempt[DEAD] = true;
        isTxLimitExempt[ZERO] = true;
        isTxLimitExempt[owner()] = true;
        isTxLimitExempt[address(this)] = true;

        uint256 _totalSupply = 1 * 10 ** 9 * 10 ** _decimals; // 10B
        _mint(owner(), _totalSupply);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function setBlacklist(
        address _address,
        bool _isBlacklisting
    ) external onlyOwner {
        blacklists[_address] = _isBlacklisting;
    }

    function setMarketPairStatus(address pair, bool status) public onlyOwner {
        isMarketPair[pair] = status;
    }

    function setLimitsHolding(
        bool _limited,
        uint256 _minHoldingAmount,
        uint256 _maxHoldingAmount
    ) external onlyOwner {
        limited = _limited;
        minHoldingAmount = _minHoldingAmount;
        maxHoldingAmount = _maxHoldingAmount;
    }

    function removeLimitsHolding() external onlyOwner {
        limited = false;
        minHoldingAmount = 0;
        maxHoldingAmount = 0;
    }

    function addSwapPair(address pair) external onlyOwner {
        if (!launched) {
            launched = true;
            emit Launch();
        }

        isMarketPair[pair] = true;
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

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (!launched && !isTxLimitExempt[from] && !isTxLimitExempt[to])
            revert NotLaunched();

        if (blacklists[from] || blacklists[to]) revert BlacklistDectected();

        if (limited && isMarketPair[from]) {
            if (amount + balanceOf(to) < minHoldingAmount)
                revert InvalidWalletAmount();

            if (amount + balanceOf(to) > maxHoldingAmount)
                revert InvalidWalletAmount();
        }
    }

    function _grantAllAccess(address account, bool value) internal virtual {
        isTxLimitExempt[account] = value;
        emit AdminGranted(account, value);
    }
}
