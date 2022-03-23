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
  
    const masterChefAddress = require(`../deployments/${chainId}/MasterChef.json`).address
    console.log("masterChefAddress:", masterChefAddress)
  
    const MasterChefUpgradeable = await ethers.getContractFactory('MasterChefUpgradeable')
    masterchefupgradeable = await upgrades.upgradeProxy(masterChefAddress, MasterChefUpgradeable, { unsafeAllow: ['delegatecall'], kind: 'uups' }) //unsafeAllowCustomTypes: true,

    log('  - MasterChefUpgradeable:         ', masterchefupgradeable.address);

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