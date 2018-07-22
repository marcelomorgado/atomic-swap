const Waves = WavesAPI.create(WavesAPI.TESTNET_CONFIG);

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

web3 = new Web3(new Web3.providers.HttpProvider("https://api.myetherapi.com/rop"));



var waves = new WavesAtomicSwap();
var ether = new EtherAtomicSwap();

var anaWavesAccount;
var anaEtherAccount;

var bobEtherAccount;
var bobWavesAccount;


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

  async refund() {
    this.validateCurrency(currency);
    if(currency == 'ETH') {

    }
    else if(currency == 'WAVES') {

    }
  }

  async init() {

    anaWavesAccount = Waves.Seed.fromExistingPhrase('medal shrug comic occur tomato topple movie media prefer lumber angle script artefact garlic fish');
    anaEtherAccount = ethereumjs.WalletHD.fromMasterSeed("fringe muscle space lady unaware vital bench strike combine obey rocket oak");

    bobEtherAccount = ethereumjs.WalletHD.fromMasterSeed("old journey someone dignity item veteran response push enter throw amazing wear");
    bobWavesAccount = Waves.Seed.fromExistingPhrase('sleep couch fold invite pony fortune silly victory away deal useless feel love sense oxygen');

    await this.etherToWaves();
    //await this.wavesToEther();
    //wait this.wavesRefund();
    //await this.etherRefund();

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

  async etherToWaves() {

    await this.showBalances();

    var ethersToSend = web3.toWei(0.05,'ether');
    var wavesToReceive = 0.5 * 10**8;

    console.log("ANA INITIATE AND FUNDING ETHER CONTRACT");
    const initiation = await ether.initiate(anaEtherAccount, bobEtherAccount.getWallet().getAddressString(), ethersToSend);
    console.log(initiation);


    console.log("BOB PARTICIPATE AND FUNDING WAVES CONTRACT");
    let initiationContractInfo = await ether.getContractTxInfo(initiation.txid);
    console.log(initiationContractInfo);
    const participation = await waves.participate(bobWavesAccount, anaWavesAccount.address, wavesToReceive, initiationContractInfo.secretHash);
    console.log(participation);


    console.log("ANA REDEEM WAVES FUNDS");
    let participationContractInfo = await waves.getContractTxInfo(participation.txid);
    console.log(participationContractInfo);
    const initiatorRedeem = await waves.redeem(anaWavesAccount.address, participationContractInfo.contractPubKey, initiation.secret);
    console.log(initiatorRedeem)


    console.log("BOB REDEEM ETHER FUNDS");
    let initiatorRedeemInfo = await waves.getRedeemTxInfo(initiatorRedeem.txid);
    console.log(initiatorRedeemInfo);
    const participatorRedeem = await ether.redeem(bobEtherAccount, initiationContractInfo.contractAddress, initiatorRedeemInfo.secret);
    console.log(participatorRedeem);

    await this.showBalances();
  }

  async wavesToEther() {

    await this.showBalances();

    var wavesToSend = 0.5 * 10**8;
    var ethersToReceive = web3.toWei(0.05,'ether');

    console.log("ANA INITIATE AND FUNDING WAVES CONTRACT");
    const initiation = await waves.initiate(anaWavesAccount, bobWavesAccount.address, wavesToSend);
    console.log(initiation);

    console.log("BOB PARTICIPATE AND FUNDING ETHER CONTRACT");
    let initiationContractInfo = await waves.getContractTxInfo(initiation.txid);
    console.log(initiationContractInfo);
    const participation = await ether.participate(bobEtherAccount, anaEtherAccount.getWallet().getAddressString(), ethersToReceive, initiationContractInfo.secretHash);
    console.log(participation);


    console.log("ANA REDEEM ETHER FUNDS");
    let participationContractInfo = await ether.getContractTxInfo(participation.txid);
    console.log(participationContractInfo);
    const initiatorRedeem = await ether.redeem(anaEtherAccount, participationContractInfo.contractAddress, initiation.secret);
    console.log(initiatorRedeem);

    console.log("BOB REDEEM WAVES FUNDS");
    let initiatorRedeemInfo = await ether.getRedeemTxInfo(initiatorRedeem.txid);
    console.log(initiatorRedeemInfo);
    const participatorRedeem = await waves.redeem(bobWavesAccount.address, initiationContractInfo.contractPubKey, initiatorRedeemInfo.secret);
    console.log(participatorRedeem);

    await this.showBalances();

  }


  async etherRefund() {

    await this.showBalances();

    var ethersToSend = web3.toWei(0.05,'ether');

    console.log("ANA INITIATE AND FUNDING ETHER CONTRACT");
    const initiation = await ether.initiate(anaEtherAccount, bobEtherAccount.getWallet().getAddressString(), ethersToSend);
    console.log(initiation);


    //console.log("ANA REFUND ETHERS");
    //const initiatorRefund = await ether.refund(anaEtherAccount, initiation.contractAddress, anaEtherAccount.getWallet().getAddressString());
    //console.log(initiatorRefund);

    await this.showBalances();

  }

  async wavesRefund() {

    await this.showBalances();

    var wavesToSend = 0.5 * 10**8;

    console.log("ANA INITIATE AND FUNDING WAVES CONTRACT");
    const initiation = await waves.initiate(anaWavesAccount, bobWavesAccount.address, wavesToSend);
    console.log(initiation);

    console.log("ANA REFUND WAVES");
    let initiationContractInfo = await waves.getContractTxInfo(initiation.txid);
    const initiatorRefund = await waves.refund(initiationContractInfo.contractPubKey, initiationContractInfo.contractAddress, anaWavesAccount.address);
    console.log(initiatorRefund);

    await this.showBalances();
  }


  async showBalances() {
    let anaWavesBalance =  (await Waves.API.Node.addresses.balance(anaWavesAccount.address)).balance;
    console.log('Ana Waves = ' + anaWavesBalance / 10**8);
    let bobWavesBalance =  (await Waves.API.Node.addresses.balance(bobWavesAccount.address)).balance;
    console.log('Bob Waves = ' + bobWavesBalance / 10**8);

    let anaEtherBalance =  web3.fromWei(await web3.eth.getBalance(anaEtherAccount.getWallet().getAddressString()), 'ether');
    console.log('Ana Ether = ' + anaEtherBalance);

    let bobEtherBalance =  web3.fromWei(await web3.eth.getBalance(bobEtherAccount.getWallet().getAddressString()), 'ether');
    console.log('Bob Ether = ' + bobEtherBalance);
  }

}
