const Waves = WavesAPI.create(WavesAPI.TESTNET_CONFIG);
web3 = new Web3(new Web3.providers.HttpProvider("https://api.myetherapi.com/rop"));

const WAVES_TX_FEE = 100000;
const WAVES_RUN_SCRIPT_FEE = WAVES_TX_FEE + 400000;
const WAVES_BLOCKS_PER_MINUTE = 1;

const ETHER_GAS_LIMIT = 4500000;

const INITIATOR_REFUND_HOURS = 48;
const PARTICIPATOR_REFUND_HOURS = 24;

const WAVES_INITIATOR_REFUND_TIME = INITIATOR_REFUND_HOURS*60*WAVES_BLOCKS_PER_MINUTE;
const WAVES_PARTICIPATOR_REFUND_TIME = PARTICIPATOR_REFUND_HOURS*60*WAVES_BLOCKS_PER_MINUTE;

const ETH_INITIATOR_REFUND_TIME = INITIATOR_REFUND_HOURS*60*60;
const ETH_PARTICIPATOR_REFUND_TIME = PARTICIPATOR_REFUND_HOURS*60*60;

var waves = new WavesAtomicSwap();
var ether = new EtherAtomicSwap();

class App {

  getInititatorRefundHours() {
    return INITIATOR_REFUND_HOURS;
  }

  getParticipantRefundHours() {
    return PARTICIPATOR_REFUND_HOURS;
  }

  getAccount(currency, mnemonic) {
    this.validateCurrency(currency);
    if(currency == 'ETH')
      return ethereumjs.WalletHD.fromMasterSeed(mnemonic);
    else if(currency == 'WAVES')
      return Waves.Seed.fromExistingPhrase(mnemonic);
  }

  async validateCurrency(currency) {
    if(currency != 'ETH' && currency != 'WAVES')
      throw "invalid currency";
  }

  async initiate(currency, inititatorAccount, participatAddress, amount) {
    this.validateCurrency(currency);
    if(currency == 'ETH') {
      amount = web3.toWei(amount, 'ether');
      return await ether.initiate(inititatorAccount, participatAddress, amount);
    }
    else if(currency == 'WAVES') {
      amount = amount * 10**8;
      return await waves.initiate(inititatorAccount, participatAddress, amount);
    }
  }

  async getContractTxInfo(currency, txid) {
    this.validateCurrency(currency);
    if(currency == 'ETH') {
      return ether.getContractTxInfo(txid);
    }
    else if(currency == 'WAVES') {
      return waves.getContractTxInfo(txid);
    }
  }

  async participate(currency, participantAccount, initiatorAddress, amount, secretHash) {
    this.validateCurrency(currency);
    if(currency == 'ETH') {
      amount = web3.toWei(amount, 'ether');
      return await ether.participate(participantAccount, initiatorAddress, amount, secretHash);
    }
    else if(currency == 'WAVES') {
      amount = amount * 10**8;
      return await waves.participate(participantAccount, initiatorAddress, amount, secretHash);
    }
  }

  async redeem(currency, partyAccount, counterPartyContractInfo, secret) {
    this.validateCurrency(currency);
    if(currency == 'ETH') {
      return await ether.redeem(partyAccount, counterPartyContractInfo.contractAddress, secret);
    }
    else if(currency == 'WAVES') {
      return await waves.redeem(partyAccount, counterPartyContractInfo.contractPubKey, secret);
    }
  }

  async refund(currency, partyAccount, counterPartyContractInfo, counterPartyAddress) {
    this.validateCurrency(currency);
    if(currency == 'ETH') {
      return await ether.refund(partyAccount, counterPartyContractInfo.contractAddress, counterPartyAddress);
    }
    else if(currency == 'WAVES') {
      return await waves.refund(partyAccount, counterPartyContractInfo.contractPubKey, counterPartyAddress);
    }
  }

  async getRedeemTxInfo(currency, txid) {
    this.validateCurrency(currency);
    if(currency == 'ETH') {
      return await ether.getRedeemTxInfo(txid);
    }
    else if(currency == 'WAVES') {
      return await waves.getRedeemTxInfo(txid);
    }
  }
}
