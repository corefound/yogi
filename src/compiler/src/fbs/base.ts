import * as fbs from "flatbuffers";
import fs from "node:fs";
import path from "node:path";

export type Constructor<T = {}> = new (...args: any[]) => T;
export type MixinFlatBuffer = (base: any) => any;

export function applyFlatBufferMixins<TBase extends Constructor>(
    Base: TBase,
    ...mixins: MixinFlatBuffer[]
): any {
    return mixins.reduce((current, mixin) => mixin(current), Base);
}

export class BaseFlatBuffer { }

export function createVector(
    builder: fbs.Builder,
    offsets: fbs.Offset[],
    startVector: (length: number) => void,
): fbs.Offset {
    startVector(offsets.length);

    for (let i = offsets.length - 1; i >= 0; i--) {
        builder.addOffset(offsets[i]);
    }

    return builder.endVector();
}

export function writeBufferToFile(buffer: Uint8Array, output: string): void {
    const dir = path.dirname(output);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(output, Buffer.from(buffer));
}

export function writeBufferToFileAsync(buffer: Uint8Array, output: string): Promise<void> {
    const dir = path.dirname(output);

    fs.mkdirSync(dir, { recursive: true });

    return new Promise<void>((resolve, reject) => {
        fs.writeFile(output, Buffer.from(buffer), (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}