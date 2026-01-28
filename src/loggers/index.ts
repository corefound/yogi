import ts from "typescript";

export class Loggers {
    static error(message: string, position: ts.LineAndCharacter, sourceText: string, fileName: string) {
        Loggers.baseError("error", message, position, sourceText, fileName);
    }

    static log(message: string, source: string) {
        console.log(message);
        process.exit(1);
    }

    static warn(message: string, source: string) {
        console.warn(message);
        process.exit(1);
    }

    static baseError(kind: string, message: string, position: ts.LineAndCharacter, sourceText: string, fileName: string) {
        const { line, character } = position;
        const lines = sourceText.split('\n');
        const lineText = lines[line];

        switch (kind) {
            case "log":
                console.log(`${fileName}:${line + 1}:${character + 1} - ${message}`);
                break;

            case "warn":
                console.log(`${fileName}:${line + 1}:${character + 1} - ${message}`);
                break;

            default:
                console.log(`${fileName}:${line + 1}:${character + 1} - ${message}`);
                break;
        }

        console.log(`${line + 1}:`, lineText);
        console.log(' '.repeat(character + `${line + 1}: `.length) + '~');
        process.exit(1);
    }
}