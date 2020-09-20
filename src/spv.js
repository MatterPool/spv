
/**
 * SPV Proof
 * ============
 *
 * A transaction that has been mined into a block can show proof of inclusion
 * in the longest chain of work through the user of merkle proofs. This can be
 * used to supplement peer-to-peer transactions to improve the trustworthiness
 * of the transaction inputs.
 */
'use strict'

import { Bw, Bn, Struct, Hash } from 'bsv'

class SPV extends Struct {
  constructor (
    blockHash,
    txId,
    txIndex,
    hashes,
    depth,
    merkleRoot
  ) {
    super({
      blockHash,
      txId,
      txIndex,
      hashes,
      depth,
      merkleRoot
    })
  }

  fromJSON (json) {
    this.fromObject({
      blockHash: Buffer.from(json.blockHash, 'hex'),
      txIndex: Bn(json.txIndex),
      hashes: json.hashes.map(h => Buffer.from(h,'hex'))
    })
    this.txId = Buffer.from(json.hashes[0], 'hex').reverse()
    this.depth = json.hashes.length
    this.merkleRoot = this.merklize()
    return this
  }

  toJSON () {
    return {
      blockHash: this.blockHash.toString('hex'),
      txId: this.txId.toString('hex'),
      txIndex: this.txIndex.toString(),
      depth: this.hashes.length,
      hashes: this.hashes.map(h => h.toString('hex')),
      merkleRoot: this.merkleRoot.toString('hex')
    }
  }

  fromBr (br) {
    this.blockHash = br.read(32)
    this.txIndex = br.readVarIntBn()
    let pairs = [];
    for(let count = br.readVarIntBn(); count.gt(0); count = count.sub(1)){
      pairs.push(br.read(32))
    }
    this.hashes = pairs
    this.txId = Buffer.from(pairs[0]).reverse()
    this.merkleRoot = this.merklize()
    return this
  }

  toBw (bw) {
    if (!bw) {
      bw = new Bw()
    }
    bw.write(this.blockHash)
    bw.writeVarIntBn(this.txIndex)
    bw.writeVarIntBn(Bn(this.hashes.length))
    bw.write(Buffer.concat(this.hashes))
    return bw
  }

  merklize () {
    if(this.txIndex.eq(0) && this.hashes.length === 1){
        return (this.hashes[0]);
    }
    let index = this.txIndex
    let hashes = this.hashes.slice();
    let hash = hashes.shift()
    while(hashes.length){
        const pair = index.mod(2).eq(0) ? [hash, hashes.shift()] : [hashes.shift(), hash]
        hash = Hash.sha256Sha256(Buffer.concat(pair))
        index = index.div(2)
    }
    return hash
  }

  validate(header) {
    return this.merkleRoot.equals(header.merkleRootBuf)
  }
}

export { SPV }