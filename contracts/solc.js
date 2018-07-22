const fs = require("fs");
const solc = require('solc');

var compile = async () => {
  var input = {
      'AtomicSwap.sol': fs.readFileSync('AtomicSwap.sol', 'utf8')
  };
  let compiledContract = solc.compile({sources: input}, 1);
  let abi = compiledContract.contracts['AtomicSwap.sol:AtomicSwap'].interface;
  let bytecode = '0x'+compiledContract.contracts['AtomicSwap.sol:AtomicSwap'].bytecode;

  console.log(bytecode);
}

compile();
