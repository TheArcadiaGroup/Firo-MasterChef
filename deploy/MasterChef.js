const {
    chainNameById,
    chainIdByName,
    saveDeploymentData,
    getContractAbi,
    log
  } = require("../js-helpers/deploy");

  module.exports = async (hre) => {
    const { ethers, upgrades } = hre;
    const network = await hre.network;
    const deployData = {};

    const signers = await ethers.getSigners()
    const chainId = chainIdByName(network.name);

    startRewardBlock = await ethers.provider.getBlockNumber() + 1000;
    endRewardBlock = startRewardBlock + 1000000;

    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    log('MasterChef Contract Deployment');
    log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

    log('  Using Network: ', chainNameById(chainId));
    log('  Using Accounts:');
    log('  - Deployer:          ', signers[0].address);
    log('  - network id:          ', chainId);
    log(' ');

    log("Deploying FiroToken...");
    const FiroToken = await ethers.getContractFactory("FiroToken");
    const FiroTokenInstance = await FiroToken.deploy();
    firotoken = await FiroTokenInstance.deployed();
    log("FiroToken address : ", firotoken.address);

    log("Deploying ERC20Mock...");
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const ERC20MockInstance = await ERC20Mock.deploy();
    erc20Mock = await ERC20MockInstance.deployed();
    log("ERC20Mock address : ", erc20Mock.address);

    log("Deploying Vesting...");
    const Vesting = await ethers.getContractFactory("Vesting");
    const VestingInstance = await Vesting.deploy();
    vesting = await VestingInstance.deployed();
    log("Vesting address : ", vesting.address);

    log("Deploying Locking...");
    const Locking = await ethers.getContractFactory("Locking");
    const LockingInstance = await Locking.deploy();
    locking = await LockingInstance.deployed(); 
    log("Locking address : ", locking.address);

    log('  Deploying MasterChef...');
    const MasterChef = await ethers.getContractFactory('MasterChef');
    masterchef = await upgrades.deployProxy(
        MasterChef, 
        [firotoken.address,
        locking.address,
        vesting.address,
        process.env.DEV_ADDRESS,
        process.env.FIRO_PER_BLOCK,
        startRewardBlock,
        endRewardBlock,
        process.env.LOCKING_DURATION,
        process.env.VESTING_DURATION], { unsafeAllow: ['delegatecall'], kind: 'uups' })
    await locking.initialize(masterchef.address);
    await vesting.initialize(firotoken.address, masterchef.address);
    await firotoken.mint(vesting.address, process.env.VESTING_FIRO_SUPPLY);
    log('  - MasterChef:         ', masterchef.address);

    deployData['MasterChef'] = {
      abi: getContractAbi('MasterChef'),
      address: masterchef.address,
      deployTransaction: masterchef.deployTransaction,
    }

    deployData['Vesting'] = {
        abi: getContractAbi('Vesting'),
        address: vesting.address,
        deployTransaction: vesting.deployTransaction,
    }

    deployData['Locking'] = {
        abi: getContractAbi('Locking'),
        address: locking.address,
        deployTransaction: locking.deployTransaction,
    }

    deployData['FiroToken'] = {
      abi: getContractAbi('FiroToken'),
      address: firotoken.address,
      deployTransaction: firotoken.deployTransaction,
  }

    saveDeploymentData(chainId, deployData);
    log('\n  Contract Deployment Data saved to "deployments" directory.');

    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
};

module.exports.tags = ['MasterChef']