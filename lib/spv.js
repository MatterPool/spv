/**
 * SPV.js - v1.0.0
 * A BSV2 SPV extension for Bitcoin SV
 * https://github.com/matterpool/spv
 * Copyright © 2020 Matterpool Inc.
 */

var spv = (function (exports, bsv) {
  'use strict';

  /**
   * SPV Proof
   * ============
   *
   * A transaction that has been mined into a block can show proof of inclusion
   * in the longest chain of work through the user of merkle proofs. This can be
   * used to supplement peer-to-peer transactions to improve the trustworthiness
   * of the transaction inputs.
   */

  class SPV extends bsv.Struct {
    constructor(blockHash, txId, txIndex, hashes, depth, merkleRoot) {
      super({
        blockHash,
        txId,
        txIndex,
        hashes,
        depth,
        merkleRoot
      });
    }

    fromJSON(json) {
      this.fromObject({
        blockHash: Buffer.from(json.blockHash, 'hex'),
        txIndex: bsv.Bn(json.txIndex),
        hashes: json.hashes.map(h => Buffer.from(h, 'hex'))
      });
      this.txId = Buffer.from(json.hashes[0], 'hex').reverse();
      this.depth = json.hashes.length;
      this.merkleRoot = this.merklize();
      return this;
    }

    toJSON() {
      return {
        blockHash: this.blockHash.toString('hex'),
        txId: this.txId.toString('hex'),
        txIndex: this.txIndex.toString(),
        depth: this.hashes.length,
        hashes: this.hashes.map(h => h.toString('hex')),
        merkleRoot: this.merkleRoot.toString('hex')
      };
    }

    fromBr(br) {
      this.blockHash = br.read(32);
      this.txIndex = br.readVarIntBn();
      let pairs = [];

      for (let count = br.readVarIntBn(); count.gt(0); count = count.sub(1)) {
        pairs.push(br.read(32));
      }

      this.hashes = pairs;
      this.txId = Buffer.from(pairs[0]).reverse();
      this.merkleRoot = this.merklize();
      return this;
    }

    toBw(bw) {
      if (!bw) {
        bw = new bsv.Bw();
      }

      bw.write(this.blockHash);
      bw.writeVarIntBn(this.txIndex);
      bw.writeVarIntBn(bsv.Bn(this.hashes.length));
      bw.write(Buffer.concat(this.hashes));
      return bw;
    }

    merklize() {
      if (this.txIndex.eq(0) && this.hashes.length === 1) {
        return this.hashes[0];
      }

      let index = this.txIndex;
      let hashes = this.hashes.slice();
      let hash = hashes.shift();

      while (hashes.length) {
        const pair = index.mod(2).eq(0) ? [hash, hashes.shift()] : [hashes.shift(), hash];
        hash = bsv.Hash.sha256Sha256(Buffer.concat(pair));
        index = index.div(2);
      }

      return hash;
    }

    validate(header) {
      return this.merkleRoot.equals(header.merkleRootBuf);
    }

  }

  /**
   * SPV Transaction
   * ============
   *
   * An SPV Transaction is an extension to a regular Bitcoin transaction that appends
   * an SPV proof which, when paired with a block header from a reliable source, enables
   * you to verify the entire transaction and its inclusion in a block in an efficient, 
   * serialised format that is backwards compatible with the serialised transaction format.
   */

  class SPVTx extends bsv.Struct {
    constructor(tx, spv) {
      super({
        tx,
        spv
      });
    }

    fromJSON(json) {
      this.tx = bsv.Tx.fromObject(json);
      this.spv = SPV.fromObject(json);
      return this;
    }

    toJSON() {
      return {
        tx: this.tx && this.tx.toJSON(),
        spv: this.spv && this.spv.toJSON()
      };
    }

    fromBr(br) {
      this.tx = bsv.Tx.fromBr(br);

      try {
        this.spv = SPV.fromBr(br);
      } catch (e) {
        this.spv = null;
      }

      return this;
    }

    toBw(bw) {
      if (!bw) {
        bw = new bsv.Bw();
      }

      const tx = this.tx.toBuffer();
      bw.write(tx);

      if (this.spv) {
        const spv = this.spv.toBuffer();
        bw.write(spv);
      }

      return bw;
    }

    validate(header) {
      if (!this.spv || !this.spv) throw new Error("SPV proof not found");
      if (!this.tx.hash().equals(this.spv.hashes[0])) throw new Error("TXID mismatch");
      if (!this.spv.merkleRoot.equals(header.merkleRootBuf)) throw new Error("Merkle root mismatch");
      if (!bsv.Hash.sha256Sha256(header.toBuffer()).reverse().equals(this.spv.blockHash)) throw new Error("Block hash mismatch");
      return true;
    }

  }

  exports.SPV = SPV;
  exports.SPVTx = SPVTx;

  return exports;

}({}, bsvjs));
