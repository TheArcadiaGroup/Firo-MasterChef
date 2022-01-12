# Firo Masterchef Smart Contracts

## install dependencies
```
npm i
```

## configure deployment keys
Copy env.example to .env and fill the required information

For example:
PRIVATE_KEY = ""
FIRO_PER_BLOCK = (firo*10^18)
LOCKING_DURATION = (86400 = 24*60*60 = 1day)
VESTING_DURATION = (86400 = 24*60*60 = 1 day)
START_REWARD_BLOCK_NUMBER = 
END_REWARD_BLOCK_NUMBER=
FIROTOKEN_CONTRACT_ADDRESS = ""
LPTOKEN_CONTRACT_ADDRESS = ""
BSC_APIKEY = (apikey for verifying the contract)

## deployments on bsctestnet
### deploy
```
npx hardhat deploy --network bsctestnet --tags masterchef
```

## notes
Please send Firo token to Vesting contract for rewarding