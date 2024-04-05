// SPDX-License-Identifier: MIT
pragma solidity ^0.6.6;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";

interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function deposit() external payable;

    function withdraw(uint256 wad) external payable;
}

contract UniswapV2Mock {
    IUniswapV2Router02 public uniswapV2Router;
    address public tokenAddress;
    address public usdtAddress;
    address public ethAddress;

    uint256 MAX_INT =
        115792089237316195423570985008687907853269984665640564039457584007913129639935;

    mapping(string => address) public swapPairsMap;

    constructor(address _tokenAddress) public {
        uniswapV2Router = IUniswapV2Router02(
            0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
        );

        tokenAddress = _tokenAddress;
        usdtAddress = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
        ethAddress = uniswapV2Router.WETH();
    }

    receive() external payable {}

    function createSwapPair() external {
        swapPairsMap["usdt"] = IUniswapV2Factory(uniswapV2Router.factory())
            .createPair(tokenAddress, usdtAddress);

        swapPairsMap["weth"] = IUniswapV2Factory(uniswapV2Router.factory())
            .createPair(tokenAddress, ethAddress);
    }

    function pairInfo(
        address tokenA,
        address tokenB
    ) public view returns (uint reserveA, uint reserveB, uint totalSupply) {
        IUniswapV2Pair pair = IUniswapV2Pair(
            UniswapV2Library.pairFor(uniswapV2Router.factory(), tokenA, tokenB)
        );
        totalSupply = pair.totalSupply();
        (uint reserves0, uint reserves1, ) = pair.getReserves();
        (reserveA, reserveB) = tokenA == pair.token0()
            ? (reserves0, reserves1)
            : (reserves1, reserves0);
    }

    function addLiquidity(string calldata pair) external {
        address swapPair = swapPairsMap[pair];

        uint256 tokenBalance = IERC20(tokenAddress).balanceOf(address(this));
        IERC20(tokenAddress).approve(swapPair, MAX_INT);
        IERC20(tokenAddress).approve(address(uniswapV2Router), MAX_INT);
        IERC20(swapPair).approve(address(uniswapV2Router), MAX_INT);

        if (swapPair == swapPairsMap["usdt"]) {
            uniswapV2Router.addLiquidity(
                tokenAddress,
                usdtAddress,
                tokenBalance / 2,
                IERC20(usdtAddress).balanceOf(address(this)),
                0,
                0,
                address(this),
                block.timestamp
            );
        } else if (swapPair == swapPairsMap["weth"]) {
            uniswapV2Router.addLiquidityETH{value: address(this).balance}(
                tokenAddress,
                tokenBalance / 2,
                0,
                0,
                address(this),
                block.timestamp
            );
        }
    }

    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        address _to,
        uint256 _deadline
    ) external {
        // transfer the amount in tokens from msg.sender to this contract
        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);

        //by calling IERC20 approve you allow the uniswap contract to spend the tokens in this contrac
        IERC20(_tokenIn).approve(address(uniswapV2Router), _amountIn);

        address[] memory path;
        path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;

        uint256[] memory amountsExpected = uniswapV2Router.getAmountsOut(
            _amountIn,
            path
        );

        uniswapV2Router.swapExactTokensForTokens(
            amountsExpected[0],
            (amountsExpected[1] * 990) / 1000, // accepting a slippage of 1%
            path,
            _to,
            _deadline
        );
    }
}
