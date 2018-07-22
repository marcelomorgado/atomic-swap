pragma solidity ^0.4.15;

contract AtomicSwap {

  struct Swap {
    uint initTimestamp;
    uint refundTime;
    bytes32 hashedSecret;
    bytes secret;
    address party;
    address counterParty;
    uint256 value;
    bool emptied;
  }

  Swap public swap;

  event Refunded(uint _refundTime);
  event Redeemed(uint _redeemTime);
  event Deployed(uint _initTimestamp, uint _refundTime, bytes32 _hashedSecret, address _party, address _counterParty, uint256 _amount);

  modifier isRedeemable(bytes _secret) {
    require(sha256(_secret) == swap.hashedSecret);
    require(block.timestamp < swap.initTimestamp + swap.refundTime);
    require(swap.emptied == false);
    _;
  }

  modifier isRefundable() {
    require(block.timestamp > swap.initTimestamp + swap.refundTime);
    require(swap.emptied == false);
    _;
  }

  constructor(uint _refundTime, bytes32 _hashedSecret, address _counterParty) payable public {

    swap.initTimestamp = block.timestamp;
    swap.refundTime = _refundTime;
    swap.hashedSecret = _hashedSecret;
    swap.party = msg.sender;
    swap.counterParty = _counterParty;
    swap.value = msg.value;

    emit Deployed(swap.initTimestamp, _refundTime, _hashedSecret, msg.sender, _counterParty, msg.value);
  }

  function redeem(bytes _secret) isRedeemable(_secret) public
  {
    swap.counterParty.transfer(swap.value);
    swap.emptied = true;
    emit Redeemed(block.timestamp);
    swap.secret = _secret;
  }

  function refund() isRefundable() public
  {
    swap.party.transfer(swap.value);
    swap.emptied = true;
    emit Refunded(block.timestamp);
  }
}
