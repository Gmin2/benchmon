// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISeasonBank} from "../src/interfaces/ISeasonBank.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "solady/tokens/ERC20.sol";
import {SeasonBank} from "../src/SeasonBank.sol";

contract TestUSDC is ERC20 {
    function name() public pure override returns (string memory) {
        return "usdc";
    }

    function symbol() public pure override returns (string memory) {
        return "USDC";
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

contract SeasonBankTest is Test {
    TestUSDC usdc;
    SeasonBank bank;
    address intermediary = makeAddr("aurora intermediary");
    address player = makeAddr("player");

    function setUp() public {
        usdc = new TestUSDC();
        bank = new SeasonBank(address(usdc), 2e6);
        usdc.mint(intermediary, 100e6);
        vm.prank(intermediary);
        usdc.approve(address(bank), type(uint256).max);
    }

    function test_depositCreditsThePlayerNotTheCaller() public {
        vm.prank(intermediary);
        bank.deposit(player, 5e6);
        assertEq(bank.credit(player), 5e6);
        assertEq(bank.credit(intermediary), 0);
        vm.prank(player);
        bank.buyPass(1);
        assertTrue(bank.hasPass(player, 1));
        assertEq(bank.credit(player), 3e6);
        vm.prank(player);
        vm.expectRevert(ISeasonBank.AlreadyHasPass.selector);
        bank.buyPass(1);
        vm.prank(player);
        bank.withdraw(3e6);
        assertEq(usdc.balanceOf(player), 3e6);
    }

    function test_depositAndBuyInOneStep() public {
        vm.prank(intermediary);
        bank.depositAndBuy(player, 7);
        assertTrue(bank.hasPass(player, 7));
        assertEq(bank.credit(player), 0);
        bank.collect(address(this));
        assertEq(usdc.balanceOf(address(this)), 2e6);
    }

    function test_guards() public {
        vm.prank(player);
        vm.expectRevert(ISeasonBank.NoCredit.selector);
        bank.buyPass(1);
        vm.prank(player);
        vm.expectRevert(ISeasonBank.NoCredit.selector);
        bank.withdraw(1);
        vm.prank(player);
        vm.expectRevert(Ownable.Unauthorized.selector);
        bank.collect(player);
    }

    // credit plus revenue always equals the usdc the bank holds
    function testFuzz_books(uint32[5] memory deposits, uint8 buys, uint32 w) public {
        address[5] memory ps;
        for (uint256 i; i < 5; i++) {
            ps[i] = address(uint160(0x3000 + i));
            uint256 a = bound(deposits[i], 1, 50e6);
            usdc.mint(intermediary, a);
            vm.prank(intermediary);
            bank.deposit(ps[i], a);
            if ((buys >> i) & 1 == 1 && bank.credit(ps[i]) >= 2e6) {
                vm.prank(ps[i]);
                bank.buyPass(1);
            }
        }
        uint256 c = bank.credit(ps[0]);
        if (c > 0) {
            vm.prank(ps[0]);
            bank.withdraw(bound(w, 1, c));
        }
        uint256 sum = bank.revenue();
        for (uint256 i; i < 5; i++) {
            sum += bank.credit(ps[i]);
        }
        assertEq(usdc.balanceOf(address(bank)), sum);
    }

    function test_priceChangeAndZeroDeposit() public {
        bank.setPassPrice(1e6);
        assertEq(bank.passPrice(), 1e6);
        vm.prank(player);
        vm.expectRevert(Ownable.Unauthorized.selector);
        bank.setPassPrice(0);
        vm.prank(intermediary);
        vm.expectRevert(ISeasonBank.ZeroAmount.selector);
        bank.deposit(player, 0);
        vm.prank(intermediary);
        vm.expectRevert(ISeasonBank.ZeroAmount.selector);
        bank.deposit(address(0), 1e6);
    }
}
