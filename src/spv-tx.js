
/**
 * SPV Transaction
 * ============
 *
 * An SPV Transaction is an extension to a regular Bitcoin transaction that appends
 * an SPV proof which, when paired with a block header from a reliable source, enables
 * you to verify the entire transaction and its inclusion in a block in an efficient, 
 * serialised format that is backwards compatible with the serialised transaction format.
 */
'use strict'

import { Tx, Struct, Bw, Hash } from 'bsv'
import { SPV } from './spv'

class SPVTx extends Struct {
  constructor (
      tx,
      spv
    ) {
    super({
      tx,
      spv
    })
  }

  fromJSON (json) {
    this.tx = Tx.fromObject(json)
    this.spv = SPV.fromObject(json)
    return this
  }

  toJSON () {
    return {
      tx: this.tx && this.tx.toJSON(),
      spv: this.spv && this.spv.toJSON()
    }
  }

  fromBr (br) {
    this.tx = Tx.fromBr(br)
    try {
        this.spv = SPV.fromBr(br)
    } catch(e) {
        this.spv = null
    }
    return this
  }

  toBw (bw) {
    if (!bw) {
      bw = new Bw()
    }
    const tx = this.tx.toBuffer()
    bw.write(tx)
    if(this.spv){
        const spv = this.spv.toBuffer()
        bw.write(spv)
    }
    return bw
  }

  validate(header) {
    if (!this.spv || !this.spv) throw new Error("SPV proof not found")
    if (!this.tx.hash().equals(this.spv.hashes[0])) throw new Error("TXID mismatch")
    if (!this.spv.merkleRoot.equals(header.merkleRootBuf)) throw new Error("Merkle root mismatch")
    if (!Hash.sha256Sha256(header.toBuffer()).reverse().equals(this.spv.blockHash)) throw new Error("Block hash mismatch")
    return true
  }
}

export { SPVTx }