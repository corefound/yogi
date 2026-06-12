import { BaseFlatBuffer, Constructor, createVector } from "./base";
import * as fbs from "flatbuffers";

import { Types } from "../helpers/types";
import { Meta, ModuleMeta, LinkEntry } from "./generated/yogi/build";

export function MetaFlatBuffer<TBase extends Constructor<BaseFlatBuffer>>(base: TBase) {
    return class extends base {
        static createGlobalMetaBuffer(input: Types.GlobalMetaInput): Uint8Array {
            const builder = new fbs.Builder(1024);

            const rootPath = builder.createString(input.rootPath);
            const cachePath = builder.createString(input.cachePath);
            const outputPath = builder.createString(input.outputPath);

            const moduleOffsets = input.modules.map((module) => {
                return this.createModuleMeta(builder, module);
            });

            const modulesVector = createVector(builder, moduleOffsets, (length) => {
                Meta.startModulesVector(builder, length);
            });

            const linkOffsets = input.links.map((link) => {
                return this.createLinkEntry(builder, link);
            });

            const linksVector = createVector(builder, linkOffsets, (length) => {
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

        static createModuleMeta(
            builder: fbs.Builder,
            module: Types.GlobalMetaModuleInput,
        ): fbs.Offset {
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

        static createLinkEntry(
            builder: fbs.Builder,
            link: Types.GlobalMetaLinkInput,
        ): fbs.Offset {
            const path = builder.createString(link.path);

            LinkEntry.startLinkEntry(builder);
            LinkEntry.addKind(builder, link.kind);
            LinkEntry.addPath(builder, path);

            return LinkEntry.endLinkEntry(builder);
        }
    };
}