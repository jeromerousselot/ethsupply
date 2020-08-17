let _this;

const BigNumber = require('bignumber.js');

export default class ethSupply {
  constructor(web3) {
    this.web3 = web3;
    _this=this;
  }

  async run() {
    console.log('start');
    const genesisSupply = 72009990.50;
    const batchSize = 10000;
    let blockRewards=0;
    let uncleRewards=0;
    const lastBlockNumber = await _this.web3.eth.getBlockNumber();
    console.log('lastBlockNumber: ' + lastBlockNumber);    
    let allMinerDiffs = 0;
    let allMinerUncleDiffs = 0;
    let invalidMinerAddress = 0;
    let burnedSupply = 0;

    for(let base=0;base<=lastBlockNumber;base+=batchSize) {
        const promises=[];
        for (let i=0;i<batchSize && (base+i)<=lastBlockNumber;i++) {
          promises.push(new Promise( (resolve,reject) => {
            const blockNumber = base+i;
            let baseReward;
            if(blockNumber<4370000) //EIP-649
              baseReward=5;
            else
            if(blockNumber<7280000) //EIP-1234
              baseReward=3;
            else
              baseReward=2;
              _this.web3.eth.getBlock(blockNumber).then(block => {

              const totalReward = baseReward + baseReward * (1 / 32) * block.uncles.length;
              blockRewards += totalReward;

              if(block.miner == '0x0000000000000000000000000000000000000000') {     
                //console.log('block ' + blockNumber + ': burn address');
                invalidMinerAddress++;
                burnedSupply += totalReward;
              } else if(blockNumber == 0) {
                console.log('not computing delta for block 0');  
              } else {
                _this.web3.eth.getBalance(block.miner, blockNumber-1, function(err, res) {
                  if (err) {
                    console.log('balance_i (miner: ' + block.miner + ', i: ' + blockNumber + '):' + err);
                  }
                  if (res) {
                    const bal_before = res;
                    console.log('i: ' + blockNumber + ', miner: ' + block.miner + ', bal_before: ' 
                                    + _this.web3.utils.fromWei(bal_before));
                    _this.web3.eth.getBalance(block.miner, blockNumber, function(err, res) {
                        if (err) {
                            console.log('bal_after: ' + err);
                        }
                        if (res) {
                            const bal_after = res;
                            console.log('i: ' + blockNumber + ', miner: ' + block.miner 
                                      + ', bal_before: ' + _this.web3.utils.fromWei(bal_before)
                                      + ', bal_after: '  + _this.web3.utils.fromWei(bal_after));
                            const miner_diff = _this.web3.utils.fromWei(bal_after) - _this.web3.utils.fromWei(bal_before);
                            allMinerDiffs = allMinerDiffs + miner_diff;
                            console.log('i: ' + blockNumber + ' miner diff: ' + miner_diff);
                        }
                    });
                  }
                });
              }

              if(block.uncles.length>0) {
                const unclePromises=[];
                let blockUncleRewards=0;
                let uncleBalancesDelta=0;
                for(let index=0;index<block.uncles.length;index++) {
                  unclePromises.push(
                    new Promise((uncleResolve,uncleReject)=>
                      _this.web3.eth.getUncle(blockNumber,index).then(uncleBlock => {
                      blockUncleRewards += baseReward * (uncleBlock.number + 8 - blockNumber) / 8;
                      let balance_uncle_i = 0; // await _this.web3.eth.getBalance(uncleBlock.miner, block.number);
                      let balance_uncle_i_1 = 0; // await _this.web3.eth.getBalance(uncleBlock.miner, block.number+1);
                      let balance_uncle_delta = balance_uncle_i_1 - balance_uncle_i ;
                      uncleBalancesDelta += balance_uncle_delta;
                      uncleResolve();
                    }))
                  );
                }
                Promise.all(unclePromises).then(()=>{
                    uncleRewards+=blockUncleRewards;
                    allMinerUncleDiffs += uncleBalancesDelta;
                    resolve()
                });
              } else {
                resolve();
              }

              if(blockNumber%batchSize===0) {
                console.log('Block ' + blockNumber + " Cumulative block rewards:"+blockRewards + ' uncle rewards:'+uncleRewards);
                console.log('Block ' + blockNumber + " minerDeltas:" + allMinerDiffs + ' uncle diffs: ' + allMinerUncleDiffs);
              }
            })
          }));
        }
        await Promise.all(promises);
    }
    console.log('\nGenesis Supply: '+genesisSupply);
    console.log('Block rewards:'+blockRewards);
    console.log('Uncle rewards:'+uncleRewards);
    console.log('Total Supply: '+ (genesisSupply+blockRewards+uncleRewards) + ' at block:'+lastBlockNumber);
    console.log('All miner diffs: ' + allMinerDiffs);
    console.log('All uncle miner diffs: ' + allMinerUncleDiffs);
    console.log('All miner + uncle miner diffs (should be close to total supply - burnt supply): ' + allMinerDiffs + allMinerUncleDiffs);
    console.log('Burned miner blocks: ' + invalidMinerAddress);
    console.log('Burned supply: ' + burnedSupply);
    console.log('Block rewards - burnedSupply: ' + (blockRewards-burnedSupply));
  }
}
