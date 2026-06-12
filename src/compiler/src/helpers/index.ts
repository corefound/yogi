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
            const code = fs.readFileSync(filePath, "utf-8");
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
            return path.resolve(path.dirname(fromFile), specifier);
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


