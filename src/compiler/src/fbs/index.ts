import { applyFlatBufferMixins, BaseFlatBuffer } from "./base";
import { MetaFlatBuffer } from "./meta";


const FlatBufferMixins = applyFlatBufferMixins(
    BaseFlatBuffer,
    MetaFlatBuffer
)

export class FlatBuffer extends FlatBufferMixins {
    
}
