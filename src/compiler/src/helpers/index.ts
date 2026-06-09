import path from "path";
import ts from "../ts";
import fs from "fs";

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

    static resolveModule = (fromFile: string, specifier: string): string => {
        if (specifier.startsWith(".")) {
            return path.resolve(path.dirname(fromFile), specifier);
        }

        // fallback for now (node_modules etc.)
        return specifier;
    };
}


