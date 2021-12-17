pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./BlackholePrevention.sol";

contract Vesting is Initializable, OwnableUpgradeable, BlackholePrevention {
    using SafeMathUpgradeable for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct VestingInfo {
        uint256 releasedAmount;
        uint256 totalAmount;
        uint256 startVestingTime;
        uint256 duration;
    }

    IERC20Upgradeable public token;
    mapping(address => VestingInfo[]) public vestings;
    uint256 public startVestingTime;
    uint256 public duration;
    mapping(address => bool) public vesters;

    event Lock(
        address user,
        uint256 amount,
        uint256 startVestingTime,
        uint256 duration
    );
    event Unlock(address user, uint256 amount);
    event SetVester(address locker, bool val);

    // address internal masterchef;

    function initialize(address _token, address _vester) public initializer {
        __Ownable_init();
        token = IERC20Upgradeable(_token);
        vesters[_vester] = true;
        emit SetVester(_vester, true);
    }

    function setVesters(address[] memory _vesters, bool val)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < _vesters.length; i++) {
            vesters[_vesters[i]] = val;
            emit SetVester(_vesters[i], val);
        }
    }

    function addVesting(
        address _addr,
        uint256 _amount,
        uint256 _startVestingTime,
        uint256 _duration
    ) external {
        require(vesters[msg.sender], "only vester can add vesting");
        unlockVesting(_addr);
        vestings[_addr].push(
            VestingInfo({
                releasedAmount: 0,
                totalAmount: _amount,
                startVestingTime: _startVestingTime,
                duration: _duration
            })
        );
        emit Lock(_addr, _amount, _startVestingTime, _duration);
    }

    function unlockVesting(address _addr) public {
        uint256 l = vestings[_addr].length;
        VestingInfo[] storage _vestings = vestings[_addr];

        uint256 k = l;
        while (k > 0) {
            uint256 i = k - 1;
            uint256 unlockable = getUnlockableVesting(_addr, i);
            if (unlockable > 0) {
                _vestings[i].releasedAmount = _vestings[i].releasedAmount.add(
                    unlockable
                );
                token.safeTransfer(_addr, unlockable);
                if (_vestings[i].releasedAmount >= _vestings[i].totalAmount) {
                    //remove vesting i
                    uint256 currentLast = _vestings.length - 1;
                    _vestings[i].releasedAmount = _vestings[currentLast]
                        .releasedAmount;
                    _vestings[i].totalAmount = _vestings[currentLast]
                        .totalAmount;
                    _vestings.pop();
                }
                emit Unlock(_addr, unlockable);
            }
            k--;
        }
    }

    function getUnlockable(address _addr) public view returns (uint256) {
        uint256 ret = 0;
        uint256 l = vestings[_addr].length;
        for (uint256 i = 0; i < l; i++) {
            ret = ret.add(getUnlockableVesting(_addr, i));
        }
        return ret;
    }

    function getUnlockableVesting(address _addr, uint256 _index)
        public
        view
        returns (uint256)
    {
        if (_index >= vestings[_addr].length) return 0;
        VestingInfo memory vesting = vestings[_addr][_index];
        if (vesting.totalAmount == 0) {
            return 0;
        }
        if (vesting.startVestingTime > block.timestamp) return 0;

        uint256 timeElapsed = block.timestamp.sub(vesting.startVestingTime);

        uint256 releasable = timeElapsed.mul(vesting.totalAmount).div(
            vesting.duration
        );
        if (releasable > vesting.totalAmount) {
            releasable = vesting.totalAmount;
        }
        return releasable.sub(vesting.releasedAmount);
    }

    function getLockedInfo(address _addr)
        external
        view
        returns (uint256 _locked, uint256 _releasable)
    {
        _releasable = getUnlockable(_addr);
        uint256 remainLocked = 0;
        uint256 l = vestings[_addr].length;
        for (uint256 i = 0; i < l; i++) {
            remainLocked = remainLocked.add(
                vestings[_addr][i].totalAmount -
                    vestings[_addr][i].releasedAmount
            );
        }
        _locked = remainLocked.sub(_releasable);
    }

    function sendRewardForDev(address devaddr, uint256 amount) external {
        require(vesters[msg.sender], "only vester can send reward for dev");
        token.safeTransfer(devaddr, amount);
    }

    function withdrawEther(address payable receiver, uint256 amount)
        external
        virtual
        onlyOwner
    {
        _withdrawEther(receiver, amount);
    }

    function withdrawERC20(
        address payable receiver,
        address tokenAddress,
        uint256 amount
    ) public virtual onlyOwner {
        _withdrawERC20(receiver, tokenAddress, amount);
    }

    function withdrawERC721(
        address payable receiver,
        address tokenAddress,
        uint256 tokenId
    ) external virtual onlyOwner {
        _withdrawERC721(receiver, tokenAddress, tokenId);
    }
}
