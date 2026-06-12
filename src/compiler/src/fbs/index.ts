import { applyFlatBufferMixins, BaseFlatBuffer } from "./base";
import { MetaFlatBuffer } from "./meta";
import { SirFlatBuffer } from "./sir";

export { LinkKind } from "./generated/yogi/build";
import { writeBufferToFile, writeBufferToFileAsync } from "./base";

const FlatBufferMixins = applyFlatBufferMixins(
    BaseFlatBuffer,
    MetaFlatBuffer,
    SirFlatBuffer,
);

export class FlatBuffer extends FlatBufferMixins {
    static writeBufferToFile(buffer: Uint8Array, output: string): void {
        writeBufferToFile(buffer, output);
    }

    static writeBufferToFileAsync(buffer: Uint8Array, output: string): Promise<void> {
        return writeBufferToFileAsync(buffer, output);
    }
}