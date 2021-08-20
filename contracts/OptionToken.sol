//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Inherited
import "./openzeppelin-l2/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IOptionToken.sol";

/**
 * @title OptionToken
 * @author Lyra
 * @dev Provides a tokenised representation of each OptionListing offered
 * by the OptionMarket.
 */
contract OptionToken is IOptionToken, ERC1155, Ownable {
  bool internal initialized = false;
  address internal optionMarket;

  constructor(string memory uri_) ERC1155(uri_) Ownable() {}

  /**
   * @dev Initialise the contract.
   * @param _optionMarket The OptionMarket contract address.
   */
  function init(address _optionMarket) external {
    require(!initialized, "contract already initialized");
    optionMarket = _optionMarket;
    initialized = true;
  }

  /**
   * @dev Initialise the contract.
   * @param newURI The new uri definition for the contract.
   */
  function setURI(string memory newURI) external override onlyOwner {
    _setURI(newURI);
  }

  /**
   * @dev Initialise the contract.
   *
   * @param account The owner of the tokens.
   * @param id The listingId + tradeType of the option.
   * @param amount The amount of options.
   */
  function mint(
    address account,
    uint id,
    uint amount
  ) external override onlyOptionMarket {
    bytes memory data;
    _mint(account, id, amount, data);
  }

  /**
   * @dev Burn the specified amount of token for the account.
   *
   * @param account The owner of the tokens.
   * @param id The listingId + tradeType of the option.
   * @param amount The amount of options.
   */
  function burn(
    address account,
    uint id,
    uint amount
  ) external override onlyOptionMarket {
    _burn(account, id, amount);
  }

  modifier onlyOptionMarket virtual {
    require(msg.sender == address(optionMarket), "only OptionMarket");
    _;
  }
}
