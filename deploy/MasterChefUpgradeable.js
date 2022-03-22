const {
    chainNameById,
    chainIdByName,
    saveDeploymentData,
    getContractAbi,
    log
  } = require("../js-helpers/deploy");
  
  const MASTERCHEF_ABI = require('../abi/MasterChef.json')
  
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
  
    let masterChefAddress = "0x48764CD6683226BD6F2E093eb9561AE751354c7a"
  
    const MasterChefUpgradeable = await ethers.getContractFactory('MasterChefUpgradeable')
    masterchefupgradeable = await upgrades.upgradeProxy(masterChefAddress, MasterChefUpgradeable, { unsafeAllow: ['delegatecall'], kind: 'uups' }) //unsafeAllowCustomTypes: true,

    log('  - MasterChefUpgradeable:         ', masterchefupgradeable.address);
    
    // await masterchefupgradeable.setStartBlock(startReward_blocknumber);
    
    // await masterchefupgradeable.setEndBlock(endReward_blocknumber);

    // await masterchefupgradeable.add("100", lptoken.address, true);

    deployData['MasterChefUpgradeable'] = {
      abi: getContractAbi('MasterChefUpgradeable'),
      address: masterchefupgradeable.address,
      deployTransaction: masterchefupgradeable.deployTransaction,
    }
  
  
    saveDeploymentData(chainId, deployData);
    log('\n  Contract Deployment Data saved to "deployments" directory.');
  
    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
  };
  
  module.exports.tags = ['masterchefupgradeable']