const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

function advanceBlock() {
    return ethers.provider.send("evm_mine")
}

async function advanceBlockTo(blockNumber) {
    for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
        await advanceBlock()
    }
}

describe("MasterChef Test", async function () {
    let [owner, user1, user2] = await ethers.getSigners();
    let firotoken, masterchef, erc20Mock, startReward_blocknumber;
    const FiroToken = await ethers.getContractFactory("FiroToken");
    const MasterChef = await ethers.getContractFactory('MasterChef');
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const Vesting = await ethers.getContractFactory("Vesting");
    const Locking = await ethers.getContractFactory("Locking");

    beforeEach(async () => {
        const FiroTokenInstance = await FiroToken.deploy();
        firotoken = await FiroTokenInstance.deployed();

        const VestingInstance = await Vesting.deploy();
        vesting = await VestingInstance.deployed();

        const LockingInstance = await Locking.deploy();
        locking = await LockingInstance.deployed();

        startReward_blocknumber = await ethers.provider.getBlockNumber() + 1000;
        endReward_blocknumber = startReward_blocknumber + 1000000;
        masterchef = await upgrades.deployProxy(
            MasterChef,
            [locking.address,
            vesting.address,
                1,
                startReward_blocknumber,
                endReward_blocknumber,
                86400,
                86400], { unsafeAllow: ['delegatecall'], kind: 'uups' })

        const ERC20MockInstance = await ERC20Mock.deploy();
        erc20Mock = await ERC20MockInstance.deployed();
        await erc20Mock.transfer(user1.address, "5000000");
        await erc20Mock.transfer(user2.address, "5000000");

        await firotoken.mint(vesting.address, 500000000000000);
        expect(await firotoken.balanceOf(vesting.address)).to.equal(500000000000000);
        await vesting.initialize(firotoken.address, masterchef.address);
        await locking.initialize(masterchef.address);

    })

    it("Deposit-Vesting", async function () {
        await masterchef.add("100", erc20Mock.address, true);
        await erc20Mock.connect(user1).approve(masterchef.address, "5000000");
        await masterchef.connect(user1).deposit(0, "3000");
        expect(await erc20Mock.balanceOf(masterchef.address)).to.equal("3000");

        await advanceBlockTo(startReward_blocknumber - 1);
        expect(await masterchef.pendingFiro(0, user1.address)).to.equal("0");
        await masterchef.connect(user1).deposit(0, "0");

        await advanceBlockTo(startReward_blocknumber + 1000);
        expect(await masterchef.pendingFiro(0, user1.address)).to.equal("999");

        await advanceBlockTo(startReward_blocknumber + 3000 - 1);
        expect(await masterchef.pendingFiro(0, user1.address)).to.equal("2998");
        await masterchef.connect(user1).deposit(0, "0");

        await ethers.provider.send('evm_increaseTime', [43200]);
        beforeFiroToken = await firotoken.balanceOf(user1.address);
        await masterchef.unlockVesting(user1.address);
        afterFiroToken = await firotoken.balanceOf(user1.address);
        expect(afterFiroToken - beforeFiroToken).to.equal(1500);

        await ethers.provider.send('evm_increaseTime', [43200]);
        beforeFiroToken = await firotoken.balanceOf(user1.address);
        await masterchef.unlockVesting(user1.address);
        afterFiroToken = await firotoken.balanceOf(user1.address);
        expect(afterFiroToken - beforeFiroToken).to.equal(1500);

        await ethers.provider.send('evm_increaseTime', [1]);
        beforeFiroToken = await firotoken.balanceOf(user1.address);
        await masterchef.unlockVesting(user1.address);
        afterFiroToken = await firotoken.balanceOf(user1.address);
        expect(afterFiroToken - beforeFiroToken).to.equal(0);
    })

    it("Withdraw-Vesting-Locking", async function () {
        await masterchef.add("100", erc20Mock.address, true);
        await erc20Mock.connect(user2).approve(masterchef.address, "5000000");
        await masterchef.connect(user2).deposit(0, "3000");
        expect(await erc20Mock.balanceOf(masterchef.address)).to.equal("3000");

        //check vesting
        await advanceBlockTo(startReward_blocknumber - 1);
        await masterchef.connect(user2).withdraw(0, "1000");

        expect(await erc20Mock.balanceOf(masterchef.address)).to.equal("2000");

        await advanceBlockTo(startReward_blocknumber + 3000 - 1);
        await masterchef.connect(user2).withdraw(0, "2000");

        expect(await erc20Mock.balanceOf(masterchef.address)).to.equal("0");

        //locking
        [isWithdrawns, tokens, unlockableAts, amounts] = await masterchef.getLockInfo(user2.address);
        expect(isWithdrawns[0]).to.equal(false);
        expect(isWithdrawns[1]).to.equal(false);
        expect(amounts[0]).to.equal(1000);
        expect(amounts[1]).to.equal(2000);

        await ethers.provider.send('evm_increaseTime', [1 * 86400]); // 1 days
        await expect(
            masterchef.unlock(user2.address, 0)
        ).to.be.revertedWith("Already withdrawn or not unlockable yet");

        before_erc20Mock = await erc20Mock.balanceOf(user2.address);
        await ethers.provider.send('evm_increaseTime', [1 * 86400]); // 1 days
        await masterchef.unlock(user2.address, 0)
        after_erc20Mock = await erc20Mock.balanceOf(user2.address);
        expect(after_erc20Mock - before_erc20Mock).to.be.equal(1000)

        //vesting
        beforeFiroToken = await firotoken.balanceOf(user2.address);
        await masterchef.unlockVesting(user2.address);
        afterFiroToken = await firotoken.balanceOf(user2.address);
        expect(afterFiroToken - beforeFiroToken).to.equal(3000);

        await expect(vesting.addVesting(user1.address, "3000", 0, 0)).to.be.revertedWith('only vester can add vesting');
        await expect(locking.lock(firotoken.address, user1.address, 0, 0)).to.be.revertedWith('only locker can lock');
    })

    it("emergencyWithdraw", async function () {
        await masterchef.add("100", erc20Mock.address, true);
        await erc20Mock.connect(user2).approve(masterchef.address, "5000000");
        await masterchef.connect(user2).deposit(0, "3000");
        expect(await erc20Mock.balanceOf(masterchef.address)).to.equal("3000");

        [amount, rewardDebt] = await masterchef.getUserInfo(0, user2.address);
        expect(amount).to.equal("3000");
        await expect(masterchef.connect(user2).emergencyWithdraw(0)).to.be.revertedWith('!isEmergency');
        [amount1, rewardDebt1] = await masterchef.getUserInfo(0, user2.address);
        expect(amount1).to.equal("3000");
        await masterchef.setEmergency(0, true);
        await masterchef.connect(user2).emergencyWithdraw(0);
        [amount, rewardDebt] = await masterchef.getUserInfo(0, user2.address);
        expect(amount).to.equal("0");
    })
    
    it("check setStartBlock/setEndBlock", async function () {

        await masterchef.setStartBlock(startReward_blocknumber);
        expect(await masterchef.getStartBlock()).to.be.equal(startReward_blocknumber);

        await masterchef.setEndBlock(startReward_blocknumber + 1000);
        expect(await masterchef.getEndBlock()).to.be.equal(startReward_blocknumber + 1000);

        await masterchef.add("100", erc20Mock.address, true);

        await erc20Mock.connect(user1).approve(masterchef.address, "5000000");
        await erc20Mock.connect(user2).approve(masterchef.address, "5000000");
        await masterchef.connect(user1).deposit(0, "3000");
        await masterchef.connect(user2).deposit(0, "6000");
        expect(await erc20Mock.balanceOf(masterchef.address)).to.equal("9000");

        await advanceBlockTo(startReward_blocknumber - 1);
        expect(await masterchef.pendingFiro(0, user1.address)).to.equal("0");
        expect(await masterchef.pendingFiro(0, user2.address)).to.equal("0");
        await masterchef.connect(user1).deposit(0, "0");
        await masterchef.connect(user2).deposit(0, "0");

        await advanceBlockTo(startReward_blocknumber + 1000);
        expect(await masterchef.pendingFiro(0, user1.address)).to.equal("333");
        expect(await masterchef.pendingFiro(0, user2.address)).to.equal("666");

        // await masterchef.connect(user1).deposit(0, "0");
        // await ethers.provider.send('evm_increaseTime', [43200]);
        // beforeFiroToken = await firotoken.balanceOf(user1.address);
        // await masterchef.unlockVesting(user1.address);
        // afterFiroToken = await firotoken.balanceOf(user1.address);
        // expect(afterFiroToken - beforeFiroToken).to.equal(166);

        // await ethers.provider.send('evm_increaseTime', [43200]);
        // beforeFiroToken = await firotoken.balanceOf(user1.address);
        // await masterchef.unlockVesting(user1.address);
        // afterFiroToken = await firotoken.balanceOf(user1.address);
        // expect(afterFiroToken - beforeFiroToken).to.equal(167);

        // await ethers.provider.send('evm_increaseTime', [1]);
        // beforeFiroToken = await firotoken.balanceOf(user1.address);
        // await masterchef.unlockVesting(user1.address);
        // afterFiroToken = await firotoken.balanceOf(user1.address);
        // expect(afterFiroToken - beforeFiroToken).to.equal(0);

        // await masterchef.connect(user1).deposit(0, "2000");
        // await advanceBlockTo(startReward_blocknumber + 5000);
        // await masterchef.connect(user1).deposit(0, "0");
        // await advanceBlockTo(startReward_blocknumber + 8000);
        // expect(await masterchef.pendingFiro(0, user1.address)).to.equal("0");

        await masterchef.setEndBlock(startReward_blocknumber + 5000);
        expect(await masterchef.getEndBlock()).to.be.equal(startReward_blocknumber + 5000);

        await advanceBlockTo(startReward_blocknumber + 2000);
        expect(await masterchef.pendingFiro(0, user1.address)).to.equal("666");
        expect(await masterchef.pendingFiro(0, user2.address)).to.equal("1333");

        await advanceBlockTo(startReward_blocknumber + 4000);
        expect(await masterchef.pendingFiro(0, user1.address)).to.equal("1333");
        expect(await masterchef.pendingFiro(0, user2.address)).to.equal("2666");
    })

    it("withdraw FIRO reward from vesting contract", async function () {
        let beforeFiroToken = await firotoken.balanceOf(user1.address);
        await vesting.withdrawERC20(user1.address, firotoken.address, 100000000);
        let afterFiroToken = await firotoken.balanceOf(user1.address);
        expect(afterFiroToken - beforeFiroToken).to.equal(100000000);
    })

    it("upgrade contract", async function () {
        const MasterChefUpgradeable = await ethers.getContractFactory('MasterChefUpgradeable')
        masterchefupgradeable = await upgrades.upgradeProxy(masterchef.address, MasterChefUpgradeable, { unsafeAllow: ['delegatecall'], kind: 'uups' }) //unsafeAllowCustomTypes: true,

        await masterchefupgradeable.setTest(startReward_blocknumber);
        expect(await masterchefupgradeable.getTest()).to.be.equal(startReward_blocknumber);
    })
})