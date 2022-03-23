# Firo Masterchef Smart Contracts

## install dependencies
```
npm i
```

## configure deployment keys
Copy env.example to .env and fill the required information

For example:

FIRO_PER_BLOCK = (firo*10^18)

LOCKING_DURATION = (86400 = 1 day)

VESTING_DURATION = (86400 = 1 day)

START_REWARD_BLOCK_NUMBER = 

END_REWARD_BLOCK_NUMBER=

FIROTOKEN_CONTRACT_ADDRESS = 

LPTOKEN_CONTRACT_ADDRESS = 

PRIVATE_KEY = 

BSC_APIKEY = (apikey for verifying the contract)

## deployments on bsctestnet
### deploy
```
npx hardhat deploy --network bscmainnet --tags masterchef

extend EndBlock: please update value of masterchefAddress and endBlock in deploy/extendEndBlock.js before run the command:
npx hardhat deploy --network bscmainnet --tags extendendblock

```

## notes
Please send Firo token to Vesting contract for rewarding