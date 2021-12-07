// SPDX-License-Identifier: ISC
pragma solidity 0.7.5;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract LyraDistributor is Ownable {
  mapping(address => uint256) public claimableBalances;
  IERC20 public token;

  event Claimed(uint256 amount, address claimer);
  event ClaimAdded(uint256 amount, address claimer);
  event ClaimRemoved(uint256 amount, address claimer);

  constructor(IERC20 _token) Ownable() {
    token = _token;
  }

  fallback() external payable {}

  function addToClaims(address[] memory addresses, uint256[] memory claimAmounts) external onlyOwner {
    require(addresses.length == claimAmounts.length, "length mismatch");

    for (uint256 i = 0; i < addresses.length; i++) {
      claimableBalances[addresses[i]] += claimAmounts[i];
      require(claimableBalances[addresses[i]] >= claimAmounts[i], "Addition overflow for balance");
      emit ClaimAdded(claimAmounts[i], addresses[i]);
    }
  }

  function removeClaims(address[] memory addresses) external onlyOwner {
    for (uint256 i = 0; i < addresses.length; i++) {
      uint256 balanceToClaim = claimableBalances[addresses[i]];
      claimableBalances[addresses[i]] = 0;
      emit ClaimRemoved(balanceToClaim, addresses[i]);
    }
  }

  function sendEth(address payable[] memory addresses, uint256[] memory ethAmounts) external onlyOwner {
    require(addresses.length == ethAmounts.length, "length mismatch");

    for (uint256 i = 0; i < addresses.length; i++) {
      addresses[i].transfer(ethAmounts[i]);
    }
  }

  function claim() external {
    uint256 balanceToClaim = claimableBalances[msg.sender];
    require(balanceToClaim > 0, "No balance to claim");
    claimableBalances[msg.sender] = 0;
    token.transfer(msg.sender, balanceToClaim);
    emit Claimed(balanceToClaim, msg.sender);
  }
}
