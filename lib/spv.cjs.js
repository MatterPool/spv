'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var bsv = require('bsv');

class SPV extends bsv.Struct {
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
    });
  }

  fromJSON (json) {
    this.fromObject({
      blockHash: Buffer.from(json.blockHash, 'hex'),
      txIndex: bsv.Bn(json.txIndex),
      hashes: json.hashes.map(h => Buffer.from(h,'hex'))
    });
    this.txId = Buffer.from(json.hashes[0], 'hex').reverse();
    this.depth = json.hashes.length;
    this.merkleRoot = this.merklize();
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
    this.blockHash = br.read(32);
    this.txIndex = br.readVarIntBn();
    let pairs = [];
    for(let count = br.readVarIntBn(); count.gt(0); count = count.sub(1)){
      pairs.push(br.read(32));
    }
    this.hashes = pairs;
    this.txId = Buffer.from(pairs[0]).reverse();
    this.merkleRoot = this.merklize();
    return this
  }

  toBw (bw) {
    if (!bw) {
      bw = new bsv.Bw();
    }
    bw.write(this.blockHash);
    bw.writeVarIntBn(this.txIndex);
    bw.writeVarIntBn(bsv.Bn(this.hashes.length));
    bw.write(Buffer.concat(this.hashes));
    return bw
  }

  merklize () {
    if(this.txIndex.eq(0) && this.hashes.length === 1){
        return (this.hashes[0])
    }
    let index = this.txIndex;
    let hashes = this.hashes.slice();
    let hash = hashes.shift();
    while(hashes.length){
        const pair = index.mod(2).eq(0) ? [hash, hashes.shift()] : [hashes.shift(), hash];
        hash = bsv.Hash.sha256Sha256(Buffer.concat(pair));
        index = index.div(2);
    }
    return hash
  }

  verify(header) {
    return this.merkleRoot.equals(header.merkleRootBuf)
  }
}

class SPVTx extends bsv.Struct {
  constructor (
      tx,
      spv
    ) {
    super({
      tx,
      spv
    });
  }

  fromJSON (json) {
    this.tx = bsv.Tx.fromObject(json);
    this.spv = SPV.fromObject(json);
    return this
  }

  toJSON () {
    return {
      tx: this.tx && this.tx.toJSON(),
      spv: this.spv && this.spv.toJSON()
    }
  }

  fromBr (br) {
    this.tx = bsv.Tx.fromBr(br);
    if(!br.eof() && br.buf.slice(br.pos,br.pos+1).equals(Buffer.alloc(1))){
      this.spv = SPV.fromBr(br);
    } else {
      this.spv = null;
    }
    return this
  }

  toBw (bw) {
    if (!bw) {
      bw = new bsv.Bw();
    }
    const tx = this.tx.toBuffer();
    bw.write(tx);
    if(this.spv){
        const spv = this.spv.toBuffer();
        bw.write(spv);
    }
    return bw
  }

  verify(header) {
    if (!this.spv || !this.spv) throw new Error("SPV proof not found")
    if (!this.tx.hash().equals(this.spv.hashes[0])) throw new Error("TXID mismatch")
    if (!this.spv.merkleRoot.equals(header.merkleRootBuf)) throw new Error("Merkle root mismatch")
    if (!bsv.Hash.sha256Sha256(header.toBuffer()).reverse().equals(this.spv.blockHash)) throw new Error("Block hash mismatch")
    return true
  }
}

exports.SPV = SPV;
exports.SPVTx = SPVTx;
