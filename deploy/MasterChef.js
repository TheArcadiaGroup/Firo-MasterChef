const {
    chainNameById,
    chainIdByName,
    saveDeploymentData,
    getContractAbi,
    log
  } = require("../js-helpers/deploy");

  module.exports = async (hre) => {
    const { ethers, upgrades, getNamedAccounts } = hre;
    const { deployer, protocolOwner, trustedForwarder } = await getNamedAccounts();
    const network = await hre.network;
    const deployData = {};

    const chainId = chainIdByName(network.name);

    let [dev] = await ethers.getSigners();
    startReward_blocknumber = await ethers.provider.getBlockNumber() + 1000;
    endReward_blocknumber = startReward_blocknumber + 1000000;

    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    log('MasterChef Contract Deployment');
    log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

    log('  Using Network: ', chainNameById(chainId));
    log('  Using Accounts:');
    log('  - Deployer:          ', deployer);
    log('  - network id:          ', chainId);
    log('  - Owner:             ', protocolOwner);
    log('  - Trusted Forwarder: ', trustedForwarder);
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
        dev.address,
        1,
        startReward_blocknumber,
        endReward_blocknumber,
        3*86400,
        86400], { unsafeAllow: ['delegatecall'], kind: 'uups' })
    await locking.initialize(masterchef.address);
    await vesting.initialize(firotoken.address, masterchef.address);
    await firotoken.mint(vesting.address, 500000000000000);
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