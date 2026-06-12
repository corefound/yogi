import { applyFlatBufferMixins, BaseFlatBuffer } from "./base";
import { MetaFlatBuffer } from "./meta";
import { Types } from "../helpers/types";
export { LinkKind } from "./generated/yogi/build";


const FlatBufferMixins = applyFlatBufferMixins(
    BaseFlatBuffer,
    MetaFlatBuffer
)

export class FlatBuffer extends FlatBufferMixins {
    public static createGlobalMetaBuffer = (_: Types.GlobalMetaInput): Uint8Array => Uint8Array.from([]);
}
