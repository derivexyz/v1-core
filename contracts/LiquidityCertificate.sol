//SPDX-License-Identifier: ISC
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

// Libraries
import "./synthetix/SafeDecimalMath.sol";

// Inherited
import "./openzeppelin-l2/ERC721.sol";
import "./interfaces/ILiquidityCertificate.sol";

/**
 * @title LiquidityCertificate
 * @author Lyra
 * @dev An ERC721 token which represents a share of the LiquidityPool.
 * It is minted when users deposit, and burned when users withdraw.
 */
contract LiquidityCertificate is ILiquidityCertificate, ERC721 {
  using SafeMath for uint;
  using SafeDecimalMath for uint;

  /// @dev The minimum amount of liquidity a certificate can be minted with.
  uint public constant override MIN_LIQUIDITY = 1e18;

  uint internal nextId;
  mapping(uint => CertificateData) internal _certificateData;
  address public override liquidityPool;
  bool internal initialized = false;

  /**
   * @param _name Token collection name
   * @param _symbol Token collection symbol
   */
  constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

  /**
   * @dev Initialize the contract.
   * @param _liquidityPool LiquidityPool address
   */
  function init(address _liquidityPool) external {
    require(!initialized, "already initialized");
    require(_liquidityPool != address(0), "liquidityPool cannot be 0 address");
    liquidityPool = _liquidityPool;
    initialized = true;
  }

  /**
   * @dev Returns all the certificates own by a given address.
   *
   * @param owner The owner of the certificates
   */
  function certificates(address owner) external view override returns (uint[] memory) {
    uint numCerts = balanceOf(owner);
    uint[] memory ids = new uint[](numCerts);

    for (uint i = 0; i < numCerts; i++) {
      ids[i] = tokenOfOwnerByIndex(owner, i);
    }

    return ids;
  }

  /**
   * @notice Returns certificate's `liquidity`.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
  function liquidity(uint certificateId) external view override returns (uint) {
    return _certificateData[certificateId].liquidity;
  }

  /**
   * @notice Returns certificate's `enteredAt`.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
  function enteredAt(uint certificateId) external view override returns (uint) {
    return _certificateData[certificateId].enteredAt;
  }

  /**
   * @notice Returns certificate's `burnableAt`.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
  function burnableAt(uint certificateId) external view override returns (uint) {
    return _certificateData[certificateId].burnableAt;
  }

  /**
   * @notice Returns a certificate's data.
   *
   * @param certificateId The id of the LiquidityCertificate.
   */
  function certificateData(uint certificateId)
    external
    view
    override
    returns (ILiquidityCertificate.CertificateData memory)
  {
    require(_certificateData[certificateId].liquidity != 0, "certificate does not exist");
    return _certificateData[certificateId];
  }

  /**
   * @dev Mints a new certificate and transfers it to `owner`.
   *
   * @param owner The account that will own the LiquidityCertificate.
   * @param liquidityAmount The amount of liquidity that has been deposited.
   * @param expiryAtCreation The time when the liquidity will become active.
   */
  function mint(
    address owner,
    uint liquidityAmount,
    uint expiryAtCreation
  ) external override onlyLiquidityPool returns (uint) {
    require(liquidityAmount >= MIN_LIQUIDITY, "liquidity value of certificate must be >= 1");

    uint certificateId = nextId++;
    _certificateData[certificateId] = CertificateData(liquidityAmount, expiryAtCreation, 0);
    _mint(owner, certificateId);

    emit CertificateDataModified(certificateId, liquidityAmount, expiryAtCreation, 0);
    return certificateId;
  }

  /**
   * @notice Sets `burnableAt` of a given certificate.
   *
   * @param certificateId The id of the LiquidityCertificate.
   * @param timestamp The time it will become burnable.
   */
  function setBurnableAt(
    address spender,
    uint certificateId,
    uint timestamp
  ) external override onlyLiquidityPool {
    require(_isApprovedOrOwner(spender, certificateId), "certificate does not exist or not owner");
    _certificateData[certificateId].burnableAt = timestamp;

    emit CertificateDataModified(
      certificateId,
      _certificateData[certificateId].liquidity,
      _certificateData[certificateId].enteredAt,
      timestamp
    );
  }

  /**
   * @notice Burns the LiquidityCertificate.
   *
   * @param spender The account which is performing the burn.
   * @param certificateId The id of the LiquidityCertificate.
   */
  function burn(address spender, uint certificateId) external override onlyLiquidityPool {
    require(_isApprovedOrOwner(spender, certificateId), "attempted to burn nonexistent certificate, or not owner");
    delete _certificateData[certificateId];
    _burn(certificateId);
  }

  /**
   * @notice Splits a LiquidityCertificate into two. Assigns `percentageSplit` of the original
   * liquidity to the new certificate.
   *
   * @param certificateId The id of the LiquidityCertificate.
   * @param percentageSplit The percentage of liquidity assigned to the new certificate.
   */
  function split(uint certificateId, uint percentageSplit) external override returns (uint) {
    require(percentageSplit < SafeDecimalMath.UNIT, "split must be less than 100%");
    require(ownerOf(certificateId) == msg.sender, "only the owner can split their certificate");
    CertificateData memory certData = _certificateData[certificateId];

    uint newCertLiquidity = certData.liquidity.multiplyDecimal(percentageSplit);
    uint oldCertLiquidity = certData.liquidity.sub(newCertLiquidity);

    require(
      newCertLiquidity >= MIN_LIQUIDITY && oldCertLiquidity >= MIN_LIQUIDITY,
      "liquidity value of both certificates must be >= 1"
    );

    _certificateData[certificateId].liquidity = oldCertLiquidity;

    uint newCertificateId = nextId++;
    _certificateData[newCertificateId] = CertificateData(newCertLiquidity, certData.enteredAt, certData.burnableAt);
    _mint(msg.sender, newCertificateId);

    emit CertificateSplit(certificateId, newCertificateId);
    emit CertificateDataModified(certificateId, oldCertLiquidity, certData.enteredAt, certData.burnableAt);
    emit CertificateDataModified(newCertificateId, newCertLiquidity, certData.enteredAt, certData.burnableAt);
    return newCertificateId;
  }

  /**
   * @dev Hook that is called before any token transfer. This includes minting and burning.
   */
  function _beforeTokenTransfer(
    address, // from
    address, // to
    uint tokenId
  ) internal view override {
    require(_certificateData[tokenId].burnableAt == 0, "cannot transfer certificates that have signalled exit");
  }

  modifier onlyLiquidityPool virtual {
    require(liquidityPool == msg.sender, "only LiquidityPool");
    _;
  }

  /**
   * @dev Emitted when a Certificate is minted, burnableAt is updated or it is split.
   */
  event CertificateDataModified(uint indexed certificateId, uint liquidity, uint enteredAt, uint burnableAt);

  /**
   * @dev Emitted when a Certificate is split.
   */
  event CertificateSplit(uint indexed certificateId, uint indexed newCertificateId);
}
