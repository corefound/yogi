import path from "path";
import ts from "../ts";
import fs from "fs";
import crypto from "crypto";
export class Helpers {
    static RESET = "\x1b[0m";
    static RED = "\x1b[31m";
    static GREEN = "\x1b[32m";
    static YELLOW = "\x1b[33m";
    static BLUE = "\x1b[34m";
    static parseFile = (filePath: string): ts.SourceFile => {
        try {
            const code = Helpers.normalizeFixedShapeTypeAnnotations(fs.readFileSync(filePath, "utf-8"));
            return ts.createSourceFile(
                filePath,
                code,
                ts.ScriptTarget.Latest,
                true,
            );

        } catch (error: any) {
            throw error?.toString()
        }
    };

    static normalizeFixedShapeTypeAnnotations(source: string): string {
        let output = "";
        let inTypeAnnotation = false;
        let index = 0;

        while (index < source.length) {
            const current = source[index];

            if (current === ":") {
                inTypeAnnotation = true;
                output += current;
                index++;
                continue;
            }

            if (current === "=") {
                const lineStart = output.lastIndexOf("\n") + 1;
                const linePrefix = output.slice(lineStart).trim();
                const startsTypeAlias =
                    /^(?:export\s+)?type\s+[A-Za-z_]\w*(?:\s*<[^>\n]+>)?\s*$/.test(linePrefix);

                inTypeAnnotation = startsTypeAlias;
                output += current;
                index++;
                continue;
            }

            if (inTypeAnnotation) {
                if (current === "[") {
                    const end = source.indexOf("]", index + 1);
                    const followsTypeName = /[A-Za-z_]\w*\s*$/.test(output);

                    if (end > index && followsTypeName) {
                        const content = source.slice(index + 1, end);
                        const isNumericShape = /^\s*\d+\s*(,\s*\d+\s*)+$/.test(content);

                        output += isNumericShape
                            ? `[${content.replace(/,/g, "|")}]`
                            : `[${content}]`;
                        index = end + 1;
                        continue;
                    }
                }

                if (current === "{" || current === ";" || current === "\n" || current === ",") {
                    inTypeAnnotation = false;
                }
            }

            output += current;
            index++;
        }

        return output;
    }

    static getQualifiedName(modulePath: string, symbolName: string): string {
        return `${modulePath?.replace(/[\\/]/g, ":")}:${symbolName}`;
    }

    static resolveFile = (filePath: string): string => {
        if (!fs.existsSync(filePath)) {
            return null;
        }

        return filePath
    };

    static resolveModule = (fromFile: string, specifier: string): string => {
        if (specifier.startsWith(".")) {
            const base = path.resolve(path.dirname(fromFile), specifier);
            const candidates = [
                base,
                `${base}.io`,
                `${base}.ts`,
                path.join(base, "index.io"),
                path.join(base, "index.ts"),
            ];

            const resolved = candidates.find((candidate) => fs.existsSync(candidate));

            if (resolved) {
                return path.resolve(resolved);
            }

            return base;
        }

        // fallback for now (node_modules etc.)
        return specifier;
    };

    static normalizePath = (path: string): string => {
        return path.replace(/\\/g, "/");
    };

    static hash = (str: string): string => {
        return crypto.createHash("sha256").update(str).digest("hex");
    };

    static mangleExport(modulePath: string, symbol: any): string {
        const moduleKey = Helpers.normalizePath(modulePath);
        const moduleHash = Helpers.hash(moduleKey).slice(0, 10);

        const signature = [
            symbol.kind,
            symbol.name,
            ...(symbol.params ?? []).map((p: any) => p.type.raw),
            symbol.returnType?.raw ?? symbol.type?.raw ?? "void",
        ].join(":");

        const signatureHash = Helpers.hash(signature).slice(0, 10);

        return `_yogi_${moduleHash}_${symbol.name}_${signatureHash}`;
    }

    static writeToFile(text: string, output: string) {
        const dir = path.dirname(output);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(output, text);
    }

    static writeJsonToFileAsync<T>(data: T, output: string) {
        const dir = path.dirname(output);

        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(output, JSON.stringify(data, null, 2), "utf8");
    }
}
