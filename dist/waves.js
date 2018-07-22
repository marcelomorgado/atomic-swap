class WavesAtomicSwap {

  async initiate(initiatorAccount, participantAddress, amount) {

    const contractAccount = Waves.Seed.create();

    const fundContractTxResult = await this.makeSimpleTransfer(initiatorAccount, contractAccount.address, amount);
    await this.waitTxConfirmation(fundContractTxResult.id);


    const refundTime = WAVES_INITIATOR_REFUND_TIME;
    const secret = Base58.encode(new TextEncoder("utf-8").encode(secureRandom(4)));
    const secretHash = CryptoJS.SHA256(secret).toString();
    const deployContractTxResult = await this.deployContract(contractAccount, initiatorAccount.address, participantAddress, refundTime, secretHash);
    await this.waitTxConfirmation(deployContractTxResult.id);

    return {
      secret: secret,
      secretHash: secretHash,
      contractAddress: contractAccount.address,
      txid: deployContractTxResult.id
    };

  }


  async participate(participantAccount, initiatorAddress, amount, secretHash) {

    const contractAccount = Waves.Seed.create();
    const fundContractTxResult = await this.makeSimpleTransfer(participantAccount, contractAccount.address, amount);
    await this.waitTxConfirmation(fundContractTxResult.id);

    const refundTime = WAVES_INITIATOR_REFUND_TIME;
    const deployContractTxResult = await this.deployContract(contractAccount, participantAccount.address, initiatorAddress, refundTime, secretHash);
    await this.waitTxConfirmation(deployContractTxResult.id);

    return {
      contractAddress: contractAccount.address,
      txid: deployContractTxResult.id
    };

  }

  async redeem(beneficiaryAccount, contractPubKey, secret) {

    const partyAddress = beneficiaryAccount.address;
    secret = Base58.encode(new TextEncoder("utf-8").encode(secret));
    const contractAddress = Waves.tools.getAddressFromPublicKey(contractPubKey);
    const amount = (await Waves.API.Node.addresses.balance(contractAddress)).balance;

    const transferTxObj = {
      timestamp: Date().now,
      amount: (amount - WAVES_RUN_SCRIPT_FEE),
      assetId: "WAVES",
      fee: WAVES_RUN_SCRIPT_FEE,
      feeAssetId: "WAVES",
      sender: contractAddress,
      senderPublicKey: contractPubKey,
      proofs: [ secret ],
      recipient: partyAddress
    };

    const transferTx = await Waves.tools.createTransaction(Waves.constants.TRANSFER_TX_NAME, transferTxObj);
    const transferTxJSON = await transferTx.getJSON();
    const redeemTxResult = await this.broadcastTx(transferTxJSON);
    await this.waitTxConfirmation(redeemTxResult.id);

    return {
      txid: redeemTxResult.id
    }
  }

  async refund(contractPubKey, contractAddress, beneficiaryAddress) {

    const amount = (await Waves.API.Node.addresses.balance(contractAddress)).balance;

    const transferTxObj = {
      timestamp: Date().now,
      amount: (amount - WAVES_RUN_SCRIPT_FEE),
      assetId: "WAVES",
      fee: WAVES_RUN_SCRIPT_FEE,
      feeAssetId: "WAVES",
      sender: contractAddress,
      senderPublicKey: contractPubKey,
      recipient: beneficiaryAddress
    };

    const transferTx = await Waves.tools.createTransaction(Waves.constants.TRANSFER_TX_NAME, transferTxObj);

    const transferTxJSON = await transferTx.getJSON();
    const refundTxResult = await this.broadcastTx(transferTxJSON);
    await this.waitTxConfirmation(refundTxResult.id);

    return {
      txid: refundTxResult.id
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
          tx = await Waves.API.Node.transactions.get(txid);
          var block = await Waves.API.Node.blocks.last();
          confs = block.height - tx.height + 1;

      } catch(err) {
        //console.log(err);
      };
    }
    return confs;

  }

  async deployContract(contractAccount, partyAddress, counterPartyAddress, refundTime, secretHash) {

    const refundHeight = refundTime;
    const initHeight = (await Waves.API.Node.blocks.last()).height;
    secretHash = Base58.encode(this.decodeHexStringToByteArray(secretHash));

    const scriptBody = `
      match tx {
        case tx:TransferTransaction =>
          let party = extract(addressFromString("${partyAddress}")).bytes
          let counterParty = extract(addressFromString("${counterPartyAddress}")).bytes
          let secretHash = base58'${secretHash}'
          let txRecipient = addressFromRecipient(tx.recipient).bytes

          let redeemTx = (txRecipient == counterParty) && sha256(tx.proofs[0]) == secretHash && height < ${initHeight} + ${refundHeight}
          let refundTx = (txRecipient == party) && height > ${initHeight} + ${refundHeight}

          redeemTx || refundTx
        case _ => false
      }
    `;

    const compiledScript = await Waves.API.Node.utils.script.compile(scriptBody);

    const setScriptObj = {
      fee: WAVES_TX_FEE,
      script: compiledScript,
      sender: contractAccount.address,
      senderPublicKey: contractAccount.keyPair.publicKey
    };

    const setScriptTx = await Waves.tools.createTransaction(Waves.constants.SET_SCRIPT_TX_NAME, setScriptObj);
    setScriptTx.addProof(contractAccount.keyPair.privateKey);

    const deployContractTx = await setScriptTx.getJSON();
    return await this.broadcastTx(deployContractTx);
  }






  async getContractTxInfo(txid) {

    let tx = await Waves.API.Node.transactions.get(txid);
    let contractAddress = tx.sender;

    let scriptText = (await rp('https://testnodes.wavesnodes.com/addresses/scriptInfo/'+contractAddress,{json:true})).scriptText
    var hashedSecret = scriptText.match(/0x(.*)/)[0].substring(2,66);
    let balance =  (await Waves.API.Node.addresses.balance(contractAddress)).balance;
    return {
      contractAddress: contractAddress,
      secretHash: hashedSecret,
      balance: balance,
      contractPubKey: tx.senderPublicKey
    }
  }


  async getRedeemTxInfo(txid) {
    let tx = await Waves.API.Node.transactions.get(txid);
    let proof = tx.proofs[0];
    let secret = new TextDecoder('utf-8').decode(Base58.decode(proof));

    return {
      secret: secret
    }
  }



  async makeSimpleTransfer(fromAccount, toAddress, amount) {

    const transferTxObj = {
      amount: amount,
      assetId: "WAVES",
      fee: WAVES_TX_FEE,
      feeAssetId: "WAVES",
      sender: fromAccount.address,
      senderPublicKey: fromAccount.keyPair.publicKey,
      recipient: toAddress,
      timestamp: Date.now()
    };

    const transferTx = await Waves.tools.createTransaction(Waves.constants.TRANSFER_TX_NAME, transferTxObj);
    transferTx.addProof(fromAccount.keyPair.privateKey);

    const transferTxJSON = await transferTx.getJSON();
    return await this.broadcastTx(transferTxJSON);

  };

  async broadcastTx(txJSON) {
    return await Waves.API.Node.transactions.rawBroadcast(txJSON);
  };

  decodeHexStringToByteArray(hexString) {
     var result = [];
     while (hexString.length >= 2) {
         result.push(parseInt(hexString.substring(0, 2), 16));
         hexString = hexString.substring(2, hexString.length);
     }
     return result;
  }

}
