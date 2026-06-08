import { BaseSemantic, Constructor } from "./base";
import ts from "../ts";
import { Kinds } from "../helpers/types";

export interface Span {
    start: ts.LineAndCharacter;
    end: ts.LineAndCharacter;
}

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";

interface Options {
    before?: number;
    after?: number;
    help?: string;
    lineOffset?: number;
}

export function LoggerSemantic<TBase extends Constructor<BaseSemantic>>(Base: TBase) {
    return class extends Base {
        public throwError(kind: Kinds.ErrrorsMessage, position: ts.LineAndCharacter, sourceText: string, context: any, endMessage: string = ""): never {
            const span: Span = {
                start: position,
                end: {
                    line: position.line,
                    character: position.character + 1,
                },
            };

            this.printSpan(span, sourceText, String(kind), Object.assign(context, {
                lineOffset: context.position.line
            }));
            console.log(endMessage);
            process.exit(1);
        }

        public printSpan(span: Span, sourceText: string, message: string, options: any): void {
            const lines = sourceText.split(/\r?\n/);

            const lineOffset = options?.lineOffset ?? 0;

            const localErrorLine = span.start.line - lineOffset;
            const errorColumn = span.start.character;

            const before = options?.before ?? 10;
            const after = options?.after ?? lines.length;

            const startLine = Math.max(0, localErrorLine - before);
            const endLine = Math.min(lines.length - 1, localErrorLine + after);

            const lastDisplayLine = lineOffset + endLine + 1;
            const gutterWidth = String(lastDisplayLine).length;

            process.stderr.write(
                `${this.modulePath} at ${span.start.line + 1}:${errorColumn + 1} - Error: ${message}\n`
            );

            process.stderr.write(`${" ".repeat(gutterWidth)} |\n`);

            for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
                const text = lines[lineIndex] ?? "";

                const displayLine = lineOffset + lineIndex + 1;
                const lineNumber = String(displayLine).padStart(gutterWidth);

                process.stderr.write(`${lineNumber} | ${text}\n`);

                if (lineIndex === localErrorLine) {
                    const marker =
                        " ".repeat(errorColumn + 1) +
                        "^".repeat(
                            Math.max(options.name.length || 1, span.end.character - span.start.character)
                        );

                    process.stderr.write(
                        `${" ".repeat(gutterWidth)} | ${RED}${marker}${RESET}\n`
                    );
                }
            }

            process.stderr.write(`${" ".repeat(gutterWidth)} |\n`);

            if (options?.help) {
                process.stderr.write(`  = ${options.help}\n`);
            }
        }
    };
}