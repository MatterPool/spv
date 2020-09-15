
/**
 * SPV Transaction
 * ============
 *
 * An SPV Transaction is an extension to a regular Bitcoin transaction that provides
 * and SPV proof which, when paired with a header buffer from a reliable source,
 * enables you to verify the entire transaction and pass this entire structure
 * around in an efficient, serialised format that is backwards compatible with
 * the serialised transaction format.
 */
'use strict'

import { Tx, Struct, Bw, BlockHeader, Hash } from 'bsv'
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
    const tx = this.tx.toBw()
    bw.write(tx.toBuffer())
    if(this.spv){
        const spv = this.spv.toBw()
        bw.write(spv.toBuffer())
    }
    return bw.toBuffer()
  }

  validate(header) {
    if (!this.spv.merkleRoot.equals(header.merkleRootBuf)) throw "Merkle root mismatch"
    if (!Hash.sha256Sha256(header.toBuffer()).reverse().equals(this.spv.blockHash)) throw "Block hash mismatch"
    return true
  }
}

export { SPVTx }