class EtherAtomicSwap {

  async initiate(initiatorAccount, participantAddress, amount) {

    const secret = Base58.encode(new TextEncoder("utf-8").encode(secureRandom(4)));
    console.log('secret: ' + secret);
    const secretHash = CryptoJS.SHA256(secret).toString();
    console.log('secret hash: ' + secretHash)

    let refundTime = ETH_INITIATOR_REFUND_TIME;
    let hashedSecret = '0x' + secretHash;
    let counterParty = participantAddress;

    const deployment = await this.deployContract(initiatorAccount, refundTime, hashedSecret, counterParty, amount);

    return {
      secret: secret,
      secretHash: secretHash,
      contractAddress: deployment.contractAddress,
      txid: deployment.txid
    }

  }


  async participate(participantAccount, initiatorAddress, amount, secretHash) {

    let refundTime = ETH_PARTICIPATOR_REFUND_TIME;
    let hashedSecret = '0x' + secretHash;
    let counterParty = initiatorAddress;

    const deployment = await this.deployContract(participantAccount, refundTime, hashedSecret, counterParty, amount);

    return {
      contractAddress: deployment.contractAddress,
      txid: deployment.txid
    }

  }

  async redeem(beneficiaryAccount, contractAddress, secret) {

    console.log('building redeem tx object...');
    const partyAddress = beneficiaryAccount.getWallet().getAddressString();
    let abi = this.contractAbi();
    let AtomicSwap = web3.eth.contract(abi);
    var atomicSwap = AtomicSwap.at(contractAddress);
    let contractData = await atomicSwap.redeem.getData(web3.toHex(secret));

    // Construct the raw transaction
    const gasPrice = await web3.eth.gasPrice;
    const gasPriceHex = web3.toHex(gasPrice);
    const gasLimitHex = web3.toHex(ETHER_GAS_LIMIT);
    const nonce = await web3.eth.getTransactionCount(partyAddress);
    const nonceHex = web3.toHex(nonce);

    const rawTx = {
        nonce: nonceHex,
        gasPrice: gasPriceHex,
        gasLimit: gasLimitHex,
        to: contractAddress,
        data: contractData
    };

    var privateKey = beneficiaryAccount.getWallet().getPrivateKey();

    const tx = new ethereumjs.Tx(rawTx);
    tx.sign(privateKey);
    const serializedTx = tx.serialize();
    console.log('sending redeem tx...');
    let txid = await web3.eth.sendRawTransaction('0x'+serializedTx.toString('hex'));
    console.log('redeem tx sent. txid: ' + txid);
    console.log('waiting for redeem tx confirmation...');
    await this.waitTxConfirmation(txid);
    console.log('tx confirmated.');

    return {
      txid: txid
    }
  }

  async refund(fromAccount, contractAddress, beneficiaryAddress) {

    console.log('building refund tx object...');
    const partyAddress = fromAccount.getWallet().getAddressString();
    let abi = this.contractAbi();
    let AtomicSwap = web3.eth.contract(abi);
    var atomicSwap = AtomicSwap.at(contractAddress);
    let contractData = await atomicSwap.refund.getData();

    // Construct the raw transaction
    const gasPrice = await web3.eth.gasPrice;
    const gasPriceHex = web3.toHex(gasPrice);
    const gasLimitHex = web3.toHex(ETHER_GAS_LIMIT);
    const nonce = await web3.eth.getTransactionCount(partyAddress);
    const nonceHex = web3.toHex(nonce);

    const rawTx = {
        nonce: nonceHex,
        gasPrice: gasPriceHex,
        gasLimit: gasLimitHex,
        to: contractAddress,
        data: contractData
    };

    var privateKey = fromAccount.getWallet().getPrivateKey();

    const tx = new ethereumjs.Tx(rawTx);
    tx.sign(privateKey);
    const serializedTx = tx.serialize();
    console.log('sending refund tx...');
    let txid = await web3.eth.sendRawTransaction('0x'+serializedTx.toString('hex'));
    console.log('refund tx sent. txid: ' + txid);
    console.log('waiting for refund tx confirmation...');
    await this.waitTxConfirmation(txid);
    console.log('tx confirmated.');

    return {
      txid: txid
    }
  }

  async getContractTxInfo(deployTxId) {

    let receipt = await web3.eth.getTransactionReceipt(deployTxId);
    let logData = receipt.logs[0].data
    let secretHash = logData.substring(2,logData.length).substring(128,192);
    let contractAddress = receipt.contractAddress;
    let balance = (await web3.eth.getBalance(contractAddress)).toNumber();

    return {
      contractAddress: contractAddress,
      secretHash: secretHash,
      balance: balance
    }
  }


  async getRedeemTxInfo(txid) {
    let tx = await web3.eth.getTransaction(txid);
    let abi = this.contractAbi();
    let AtomicSwap = web3.eth.contract(abi);
    var atomicSwap = AtomicSwap.at(tx.to);
    let secretHex = await atomicSwap.swap.call()[3];
    let secret = web3.toAscii(secretHex);

    return {
      secret: secret
    }
  }


  contractAbi() {
    let abi = [{"constant":false,"inputs":[],"name":"refund","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"swap","outputs":[{"name":"initTimestamp","type":"uint256"},{"name":"refundTime","type":"uint256"},{"name":"hashedSecret","type":"bytes32"},{"name":"secret","type":"bytes"},{"name":"party","type":"address"},{"name":"counterParty","type":"address"},{"name":"value","type":"uint256"},{"name":"emptied","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_secret","type":"bytes"}],"name":"redeem","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[{"name":"_refundTime","type":"uint256"},{"name":"_hashedSecret","type":"bytes32"},{"name":"_counterParty","type":"address"}],"payable":true,"stateMutability":"payable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_refundTime","type":"uint256"}],"name":"Refunded","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_redeemTime","type":"uint256"}],"name":"Redeemed","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"_initTimestamp","type":"uint256"},{"indexed":false,"name":"_refundTime","type":"uint256"},{"indexed":false,"name":"_hashedSecret","type":"bytes32"},{"indexed":false,"name":"_party","type":"address"},{"indexed":false,"name":"_counterParty","type":"address"},{"indexed":false,"name":"_amount","type":"uint256"}],"name":"Deployed","type":"event"}];
    return abi;
  }

  async deployContract(partyAccount, refundTime, hashedSecret, counterPartyAddress, amount) {

    console.log('building deploy contract tx object...');
    let abi = this.contractAbi();

    let bytecode = "0x608060405260405160608061061e8339810160408181528251602080850151948301514260008190556001849055600287905560048054600160a060020a03199081163390811790925560058054600160a060020a0386169216821790553460068190559288529387018590528587018890526060870152608086019290925260a085019190915291519093927f46edc43d805d412c94753474b7eed23ae8601aacb8cf52c0b223b6aae09404e0919081900360c00190a1505050610555806100c96000396000f3006080604052600436106100565763ffffffff7c0100000000000000000000000000000000000000000000000000000000600035041663590e1ae3811461005b5780638119c065146100725780639945e3d314610151575b600080fd5b34801561006757600080fd5b506100706101aa565b005b34801561007e57600080fd5b50610087610258565b6040805189815260208082018a905291810188905273ffffffffffffffffffffffffffffffffffffffff8087166080830152851660a082015260c0810184905282151560e08201526101006060820181815288519183019190915287519192909161012084019189019080838360005b8381101561010f5781810151838201526020016100f7565b50505050905090810190601f16801561013c5780820380516001836020036101000a031916815260200191505b50995050505050505050505060405180910390f35b34801561015d57600080fd5b506040805160206004803580820135601f81018490048402850184019095528484526100709436949293602493928401919081908401838280828437509497506103309650505050505050565b6001546000540142116101bc57600080fd5b60075460ff16156101cc57600080fd5b60045460065460405173ffffffffffffffffffffffffffffffffffffffff9092169181156108fc0291906000818181858888f19350505050158015610215573d6000803e3d6000fd5b506007805460ff191660011790556040805142815290517f3d2a04f53164bedf9a8a46353305d6b2d2261410406df3b41f99ce6489dc003c9181900360200190a1565b6000805460018054600280546003805460408051602097831615610100026000190190921694909404601f8101879004870282018701909452838152959693959194919290918301828280156102ef5780601f106102c4576101008083540402835291602001916102ef565b820191906000526020600020905b8154815290600101906020018083116102d257829003601f168201915b50505050600483015460058401546006850154600790950154939473ffffffffffffffffffffffffffffffffffffffff928316949290911692509060ff1688565b6002805460405183518493918491819060208401908083835b602083106103685780518252601f199092019160209182019101610349565b51815160209384036101000a600019018019909216911617905260405191909301945091925050808303816000865af11580156103a9573d6000803e3d6000fd5b5050506040513d60208110156103be57600080fd5b5051146103ca57600080fd5b6001546000540142106103dc57600080fd5b60075460ff16156103ec57600080fd5b60055460065460405173ffffffffffffffffffffffffffffffffffffffff9092169181156108fc0291906000818181858888f19350505050158015610435573d6000803e3d6000fd5b506007805460ff191660011790556040805142815290517f82498456531a1065f689ba348ce20bda781238c424cf36748dd40bc282831e039181900360200190a1815161048990600390602085019061048e565b505050565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106104cf57805160ff19168380011785556104fc565b828001600101855582156104fc579182015b828111156104fc5782518255916020019190600101906104e1565b5061050892915061050c565b5090565b61052691905b808211156105085760008155600101610512565b905600a165627a7a72305820b599efa7e282bec86f06499a52df95e46068ea31b2e5df2abc1fcf1787f228e40029";

    //let AtomicSwap = web3.eth.contract(JSON.parse(abi));
    let AtomicSwap = web3.eth.contract(abi);


    // NEW
    const partyAddress = partyAccount.getWallet().getAddressString();
    const contractData = AtomicSwap.new.getData(web3.toHex(refundTime), web3.toHex(hashedSecret), counterPartyAddress, {
      //data: '0x' + bytecode
      data: bytecode
    });

    // Construct the raw transaction
    const gasPrice = await web3.eth.gasPrice;
    const gasPriceHex = web3.toHex(gasPrice);
    const gasLimitHex = web3.toHex(ETHER_GAS_LIMIT);
    const amountHex = web3.toHex(amount);
    const nonce = await web3.eth.getTransactionCount(partyAddress);
    const nonceHex = web3.toHex(nonce);

    const rawTx = {
        nonce: nonceHex,
        gasPrice: gasPriceHex,
        gasLimit: gasLimitHex,
        //gas: gas,
        value: amountHex,
        data: contractData
    };

    var privateKey = partyAccount.getWallet().getPrivateKey();

    const tx = new ethereumjs.Tx(rawTx);
    tx.sign(privateKey);
    const serializedTx = tx.serialize();

    console.log('sending contract deploy tx...');
    let txid = await web3.eth.sendRawTransaction('0x'+serializedTx.toString('hex'));
    console.log('contract deployed. txid: ' + txid);
    console.log('waiting for tx confirmation...');
    await this.waitTxConfirmation(txid);
    let contractAddress = await web3.eth.getTransactionReceipt(txid).contractAddress;
    //var atomicSwap = AtomicSwap.at(contractAddress);
    console.log('tx confirmated. contract address: ' + contractAddress)

    return {
      txid: txid,
      contractAddress: contractAddress
    }

  }


  async waitTxConfirmation(txid) {

    var confs = 0;
    do {
      confs = await this.getTxConfirmations(txid);
    }
    while(confs < 1);

  }

  async getTxConfirmations(txid) {
    var confs = 0;
    var tx = null;
    while(tx == null && confs == 0) {
      wait(1000*2);
      try {
          tx = await web3.eth.getTransactionReceipt(txid);
          var blockHeight = await web3.eth.blockNumber;
          confs = blockHeight - tx.blockNumber + 1;

      } catch(err) {
        //console.log(err);
      };
    }
    return confs;

  }


}
