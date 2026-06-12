import { BaseSemantic, Constructor } from "./base";
import ts from "../ts";
import { Kinds } from "../helpers/types";

export interface Span {
    start: ts.LineAndCharacter;
    end: ts.LineAndCharacter;
}


interface Options {
    before?: number;
    after?: number;
    help?: string;
    lineOffset?: number;
}

export function LoggerSemantic<TBase extends Constructor<BaseSemantic>>(Base: TBase) {
    return class extends Base {
        public throwError(kind: Kinds.ErrrorsMessage, position: ts.LineAndCharacter, sourceText: string, context: any, endMessage: string = ""): never {
            const arrowLength = Math.max(1, context?.arrowLength ?? 1);
            const span: Span = {
                start: position,
                end: {
                    line: position.line,
                    character: position.character + arrowLength,
                },
            };

            this.printSpan(span, sourceText, String(kind), {
                ...context,
                arrowLength,
                lineOffset: context?.position?.line ?? position.line,
            });

            if (endMessage) {
                process.stderr.write(`${endMessage}\n`);
            }

            process.exit(1);
        }

        public printSpan(span: Span, sourceText: string, message: string, options: any): void {
            const source = this.sourceText || sourceText || "";
            let lines = source.split(/\r?\n/);
            let lineIndex = span.start.line;

            if (lineIndex >= lines.length && sourceText) {
                lines = sourceText.split(/\r?\n/);
                lineIndex = Math.max(0, Math.min(options?.lineOffset ?? 0, lines.length - 1));
            }

            const rawLine = lines[lineIndex] ?? "";
            const displayLine = rawLine.replace(/\t/g, "    ");
            const errorColumn = Math.max(0, Math.min(span.start.character, displayLine.length));
            const arrowLength = Math.max(
                1,
                Math.min(options?.arrowLength ?? 1, Math.max(1, displayLine.length - errorColumn)),
            );
            const lineNumber = lineIndex + 1;
            const columnNumber = errorColumn + 1;
            const gutterWidth = String(lineNumber).length;
            const gutter = " ".repeat(gutterWidth);
            const pointer = `${" ".repeat(errorColumn)}${"^".repeat(arrowLength)}`;

            process.stderr.write(
                `${this.modulePath.absolutePath}:${lineNumber}:${columnNumber} - error: ${message}\n\n`
            );

            process.stderr.write(`${gutter} |\n`);
            process.stderr.write(`${lineNumber} | ${displayLine}\n`);
            process.stderr.write(`${gutter} | ${pointer}\n`);

            if (options?.help) {
                process.stderr.write(`  = ${options.help}\n`);
            }
        }
    };
}
