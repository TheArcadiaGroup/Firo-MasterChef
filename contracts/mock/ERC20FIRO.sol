// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// mock class using ERC20
contract ERC20FIRO is ERC20 {
    constructor() payable ERC20("ERC20FIRO", "ERC20FIRO") {
        _mint(msg.sender, 10000000000e18);
    }

    function decimals() public view virtual override returns (uint8) {
        return 8;
    }

    function mint(address account) public {
        _mint(account, 1000000e8);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }

    function transferInternal(
        address from,
        address to,
        uint256 value
    ) public {
        _transfer(from, to, value);
    }

    function approveInternal(
        address owner,
        address spender,
        uint256 value
    ) public {
        _approve(owner, spender, value);
    }
}
