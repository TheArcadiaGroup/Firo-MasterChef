// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./FiroToken.sol";
import "./lib/Vesting.sol";
import "./lib/Locking.sol";

interface IMigratorChef {
    // Perform LP token migration from legacy UniswapV2 to FiroSwap.
    // Take the current LP token address and return the new LP token address.
    // Migrator should have full access to the caller's LP token.
    // Return the new LP token address.
    //
    // XXX Migrator must have allowance access to UniswapV2 LP tokens.
    // FiroSwap must mint EXACTLY the same amount of FiroSwap LP tokens or
    // else something bad will happen. Traditional UniswapV2 does not
    // do that so be careful!
    function migrate(IERC20Upgradeable token) external returns (IERC20Upgradeable);
}

// MasterChef is the master of Firo. He can make Firo and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once FIRO is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MasterChef is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.

        //
        // We do some fancy math here. Basically, any point in time, the amount of FIROs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accFiroPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accFiroPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20Upgradeable lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. FIROs to distribute per block.
        uint256 lastRewardBlock; // Last block number that FIROs distribution occurs.
        uint256 accFiroPerShare; // Accumulated FIROs per share, times 1e12. See below.
        bool    isEmergency;
    }
    // The FIRO TOKEN!
    FiroToken public firo;

    // Dev address.
    address public devaddr;
    // Block number when bonus FIRO period ends.
    uint256 public bonusEndBlock;
    // FIRO tokens created per block.
    uint256 public firoPerBlock;
    // The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IMigratorChef public migrator;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The block number when FIRO mining starts.
    uint256 public startBlock;

    Vesting public vesting;

    Locking public locking;

    uint256 public poolLockedTime;

    uint256 public vestingDuration;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amounts
    );

    function initialize(
        address _firo,
        address _locking,
        address _vesting,
        address _devaddr,
        uint256 _firoPerBlock,
        uint256 _startBlock,
        uint256 _bonusEndBlock,
        uint256 _poolLockedTime,
        uint256 _vestingDuration
        ) public initializer {
        __Ownable_init();
        firo = FiroToken(_firo);
        locking = Locking(_locking);
        vesting = Vesting(_vesting);
        devaddr = _devaddr;
        firoPerBlock = _firoPerBlock;
        startBlock = _startBlock;
        bonusEndBlock = _bonusEndBlock;
        poolLockedTime = _poolLockedTime;
        vestingDuration = _vestingDuration;
    }
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(
        uint256 _allocPoint,
        IERC20Upgradeable _lpToken,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock =
            block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accFiroPerShare: 0,
                isEmergency: false
            })
        );
    }

    // Update the given pool's FIRO allocation point. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(
            _allocPoint
        );
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Set the migrator contract. Can only be called by the owner.
    function setMigrator(IMigratorChef _migrator) public onlyOwner {
        migrator = _migrator;
    }

    // Migrate lp token to another lp contract. Can be called by anyone. We trust that migrator contract is good.
    function migrate(uint256 _pid) public {
        require(address(migrator) != address(0), "migrate: no migrator");
        PoolInfo storage pool = poolInfo[_pid];
        IERC20Upgradeable lpToken = pool.lpToken;
        uint256 bal = lpToken.balanceOf(address(this));
        lpToken.safeApprove(address(migrator), bal);
        IERC20Upgradeable newLpToken = migrator.migrate(lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "migrate: bad");
        pool.lpToken = newLpToken;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to)
        public
        view
        returns (uint256)
    {
        if (_to <= bonusEndBlock) {
            return _to.sub(_from);
        } else if (_from >= bonusEndBlock) {
            return _to.sub(_from);
        } else {
            return
                bonusEndBlock.sub(_from).add(
                    _to.sub(bonusEndBlock)
                );
        }
    }

    // View function to see pending FIROs on frontend.
    function pendingFiro(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accFiroPerShare = pool.accFiroPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier =
                getMultiplier(pool.lastRewardBlock, block.number);
            uint256 firoReward =
                multiplier.mul(firoPerBlock).mul(pool.allocPoint).div(
                    totalAllocPoint
                );
            accFiroPerShare = accFiroPerShare.add(
                firoReward.mul(1e12).div(lpSupply)
            );
        }
        return user.amount.mul(accFiroPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 firoReward =
            multiplier.mul(firoPerBlock).mul(pool.allocPoint).div(
                totalAllocPoint
            );
        vesting.sendRewardForDev(devaddr, firoReward.div(10));
        pool.accFiroPerShare = pool.accFiroPerShare.add(
            firoReward.mul(1e12).div(lpSupply)
        );
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for FIRO allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accFiroPerShare).div(1e12).sub(
                    user.rewardDebt
                );
            if(pending>0) {
                addVesting(msg.sender, pending, block.timestamp, vestingDuration);
            }
            
        }
        pool.lpToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );

        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accFiroPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending =
            user.amount.mul(pool.accFiroPerShare).div(1e12).sub(
                user.rewardDebt
            );
        if(pending>0) {
                addVesting(msg.sender, pending, block.timestamp, vestingDuration);
        }
        user.amount = user.amount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accFiroPerShare).div(1e12);
        pool.lpToken.safeApprove(address(locking), _amount);
        lock(address(pool.lpToken), msg.sender, _amount, poolLockedTime);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        if (pool.isEmergency == false) return;
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);    
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    function setEmergency(uint256 _pid, bool _isEmergency) public onlyOwner {
        require(_pid < poolInfo.length, "pid is invalid");
        poolInfo[_pid].isEmergency = _isEmergency;
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "dev: wut?");
        devaddr = _devaddr;
    }

    function getUserInfo(uint256 _pid, address _user) public view returns (uint256 amount, uint256 rewardDebt){
        amount = userInfo[_pid][_user].amount;
        rewardDebt = userInfo[_pid][_user].rewardDebt;
    }

    function getPoolInfo(uint256 _pid) public view returns (
        uint256 allocPoint, 
        uint256 lastRewardBlock, 
        uint256 accFiroPerShare
        ){
        allocPoint = poolInfo[_pid].allocPoint;
        lastRewardBlock = poolInfo[_pid].lastRewardBlock;
        accFiroPerShare = poolInfo[_pid].accFiroPerShare;
    }

    // Safe firo transfer function, just in case if rounding error causes pool to not have enough FIROs.
    function addVesting(address _addr, uint256 _amount, uint256 _startVestingTime, uint256 _duration) internal {
        vesting.addVesting(_addr, _amount, _startVestingTime, _duration);
    }

    function unlockVesting(address _addr) public {
        vesting.unlockVesting(_addr);
    }    

    function lock(address _token, address _addr, uint256 _amount, uint256 _lockedTime) public {
        locking.lock(_token, _addr, _amount, _lockedTime);
    }

    function unlock(address _addr, uint256 index) public {
        locking.unlock(_addr, index);
    }

    function getLockInfo(address _user) external view returns (
            bool[] memory isWithdrawns,
            address[] memory tokens,
            uint256[] memory unlockableAts,
            uint256[] memory amounts
        )
    {
        return locking.getLockInfo(_user);
    }

    function getLockInfoByIndexes(address _addr, uint256[] memory _indexes) external view returns (
            bool[] memory isWithdrawns,
            address[] memory tokens,
            uint256[] memory unlockableAts,
            uint256[] memory amounts
        )
    {
        return locking.getLockInfoByIndexes(_addr, _indexes);
    }

    function getLockInfoLength(address _addr) external view returns (uint256) {
        return locking.getLockInfoLength(_addr);
    }    
}
