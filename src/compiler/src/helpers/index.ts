import path from "path";
import ts from "../ts";
import fs from "fs";

export class Helpers {
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


