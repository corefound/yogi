import * as fbs from "flatbuffers";
import fs from "fs";
import path from "path";

import { Meta } from "./yogi/meta/meta";
import { ModuleMeta } from "./yogi/meta/module-meta";
import { LinkEntry } from "./yogi/meta/link-entry";
import { Types } from "../helpers/types";

export { LinkKind } from "./yogi/meta/link-kind";


export class FlatBuffer {
    static createGlobalMeta(input: Types.GlobalMetaInput): Uint8Array {
        const builder = new fbs.Builder(1024);

        const rootPath = builder.createString(input.rootPath);
        const cachePath = builder.createString(input.cachePath);
        const outputPath = builder.createString(input.outputPath);

        const moduleOffsets = input.modules.map((module) => {
            return FlatBuffer.createModuleMeta(builder, module);
        });

        const modulesVector = FlatBuffer.createVector(builder, moduleOffsets, (length) => {
            Meta.startModulesVector(builder, length);
        });

        const linkOffsets = input.links.map((link) => {
            return FlatBuffer.createLinkEntry(builder, link);
        });

        const linksVector = FlatBuffer.createVector(builder, linkOffsets, (length) => {
            Meta.startLinksVector(builder, length);
        });

        Meta.startMeta(builder);
        Meta.addRootPath(builder, rootPath);
        Meta.addCachePath(builder, cachePath);
        Meta.addOutputPath(builder, outputPath);
        Meta.addModules(builder, modulesVector);
        Meta.addLinks(builder, linksVector);

        const meta = Meta.endMeta(builder);

        builder.finish(meta);

        return builder.asUint8Array();
    }

    private static createModuleMeta(builder: fbs.Builder, module: Types.GlobalMetaModuleInput): fbs.Offset {
        const name = builder.createString(module.name);
        const sourcePath = builder.createString(module.sourcePath);
        const sourceHash = builder.createString(module.sourceHash);
        const astHash = builder.createString(module.astHash);
        const sirHash = builder.createString(module.sirHash);

        ModuleMeta.startModuleMeta(builder);
        ModuleMeta.addName(builder, name);
        ModuleMeta.addSourcePath(builder, sourcePath);
        ModuleMeta.addSourceHash(builder, sourceHash);
        ModuleMeta.addAstHash(builder, astHash);
        ModuleMeta.addSirHash(builder, sirHash);
        ModuleMeta.addShouldLower(builder, module.shouldLower);
        ModuleMeta.addIsEntry(builder, module.isEntry);

        return ModuleMeta.endModuleMeta(builder);
    }

    private static createLinkEntry(builder: fbs.Builder, link: Types.GlobalMetaLinkInput): fbs.Offset {
        const path = builder.createString(link.path);

        LinkEntry.startLinkEntry(builder);
        LinkEntry.addKind(builder, link.kind);
        LinkEntry.addPath(builder, path);

        return LinkEntry.endLinkEntry(builder);
    }


    private static createVector(builder: fbs.Builder, offsets: fbs.Offset[], startVector: (length: number) => void): fbs.Offset {
        startVector(offsets.length);

        for (let i = offsets.length - 1; i >= 0; i--) {
            builder.addOffset(offsets[i]);
        }

        return builder.endVector();
    }

    static writeBufferToFile(buffer: Uint8Array, output: string) {
        const dir = path.dirname(output);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(output, Buffer.from(buffer));
    }
}