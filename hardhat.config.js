require('dotenv').config();

require("@nomiclabs/hardhat-web3");


const {
  TASK_TEST,
  TASK_COMPILE_GET_COMPILER_INPUT
} = require('hardhat/builtin-tasks/task-names');

require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');
require('hardhat-abi-exporter');
require('solidity-coverage');
require('hardhat-deploy-ethers');
require('hardhat-deploy');

// This must occur after hardhat-deploy!
task(TASK_COMPILE_GET_COMPILER_INPUT).setAction(async (_, __, runSuper) => {
  const input = await runSuper();
  input.settings.metadata.useLiteralContent = process.env.USE_LITERAL_CONTENT != 'false';
  console.log(`useLiteralContent: ${input.settings.metadata.useLiteralContent}`);
  return input;
});

// Task to run deployment fixtures before tests without the need of "--deploy-fixture"
//  - Required to get fixtures deployed before running Coverage Reports
task(
  TASK_TEST,
  "Runs the coverage report",
  async (args, hre, runSuper) => {
    await hre.run('compile');
    await hre.deployments.fixture();
    return runSuper({...args, noCompile: true});
  }
);

 module.exports = {
   defaultNetwork: "hardhat",
   networks: {
     localhost: {
        url: "http://127.0.0.1:8545"
     },
     hardhat: {
       forking: {
         url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`
       }
     },
     kovan: {
       url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
       gasPrice: 6e9,
       accounts: [process.env.PRIVATE_KEY_42],
     },
     mainnet: {
       url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
       gasPrice: 100e9,
       accounts: [process.env.PRIVATE_KEY_1],
     }
   },
   solidity: {
     version: "0.8.3",
     settings: {
       optimizer: {
         enabled: true,
         runs: 200
       }
     }
   },
   paths: {
     sources: "./contracts",
     tests: "./test",
     cache: "./cache",
     artifacts: "./build/artifacts",
     deploy: './deploy',
     deployments: './deployments'
   },
   mocha: {
     timeout: 20000
   },
   abiExporter: {
    path: './abi',
    clear: true,
    flat: true,
   },
 };