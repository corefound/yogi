import ts from "@/ts";
import util from "node:util";


export class Loggers {
    static error(message: string, position: ts.LineAndCharacter, sourceText: string, fileName: string) {
        Loggers.baseError("error", message, position, sourceText, fileName);
    }

    static log(message: string, source: string) {
        console.log(message);
        process.exit(0);
    }

    static warn(message: string, source: string) {
        console.warn(message);
        process.exit(1);
    }

    static baseError(kind: string, message: string, position: ts.LineAndCharacter, sourceText: string, fileName: string) {
        const { line, character } = position;
        const lines = sourceText.split('\n');
        const lineText = lines[line];

        const msg = `${fileName}:${line + 1}:${character + 1} - ${message} \n`
        const error = `${line + 1}: ${lineText} \n `;
        const underline = ' '.repeat(character + `${line + 1}: `.length) + '~';

        console.log(util.inspect({ ok: false, error: msg + error + underline }, {
            colors: true,
            depth: null,
        }));

        process.exit(1);
    }
}