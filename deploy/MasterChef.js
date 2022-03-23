const {
  chainNameById,
  chainIdByName,
  saveDeploymentData,
  getContractAbi,
  log
} = require("../js-helpers/deploy");

const ERC20_ABI = require('../abi/ERC20.json')

module.exports = async (hre) => {
  const { ethers, upgrades } = hre;
  const network = await hre.network;
  const deployData = {};

  const signers = await ethers.getSigners()
  const chainId = chainIdByName(network.name);

  log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  log('MasterChef Contract Deployment');
  log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

  log('  Using Network: ', chainNameById(chainId));
  log('  Using Accounts:');
  log('  - Deployer:          ', signers[0].address);
  log('  - network id:          ', chainId);
  log(' ');

  const firotoken = await ethers.getContractAt(ERC20_ABI, process.env.FIROTOKEN_CONTRACT_ADDRESS);
  const lptoken = await ethers.getContractAt(ERC20_ABI, process.env.LPTOKEN_CONTRACT_ADDRESS);

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
    [locking.address,
    vesting.address,
    process.env.FIRO_PER_BLOCK,
    process.env.START_REWARD_BLOCK_NUMBER,
    process.env.END_REWARD_BLOCK_NUMBER,
    process.env.LOCKING_DURATION,
    process.env.VESTING_DURATION], { unsafeAllow: ['delegatecall'], kind: 'uups' })
  await locking.initialize(masterchef.address);
  await vesting.initialize(firotoken.address, masterchef.address);

  await masterchef.add("100", lptoken.address, true);

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

  saveDeploymentData(chainId, deployData);
  log('\n  Contract Deployment Data saved to "deployments" directory.');

  log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
};

module.exports.tags = ['masterchef']