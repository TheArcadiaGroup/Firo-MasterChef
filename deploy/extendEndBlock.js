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
  
    let masterchefAddress = "0xC6648BD0bbdfD58A19A04211B9A345790DeDD229"
    let endBlock = 10000000

    const masterchef = await ethers.getContractAt(MASTERCHEF_ABI, masterchefAddress);

    log('  - MasterChef:         ', masterchef.address);
  
    await masterchef.setEndBlock(endBlock);
  
    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
  };
  
  module.exports.tags = ['extendendblock']