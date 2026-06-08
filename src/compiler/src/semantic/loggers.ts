import { BaseSemantic, Constructor } from "./base";
import ts from "../ts";
import { Kinds } from "../helpers/types";

export interface Span {
    start: ts.LineAndCharacter;
    end: ts.LineAndCharacter;
}

export function LoggerSemantic<TBase extends Constructor<BaseSemantic>>(Base: TBase) {
    return class extends Base {
        public typeError(kind: Kinds.ErrrorsMessage, position: ts.LineAndCharacter, sourceText: string): never {
            this.printSpan(
                {
                    start: position,
                    end: {
                        line: position.line,
                        character: position.character + 1,
                    },
                },
                sourceText,
                String(kind)
            );

            process.exit(1);
        }

        public printSpan(span: Span, sourceText: string, message: string): void {
            const lines = sourceText.split(/\r?\n/);

            const startLine = span.start.line;
            const endLine = span.end.line;

            if (
                startLine < 0 ||
                startLine >= lines.length ||
                endLine < 0 ||
                endLine >= lines.length
            ) {
                process.stderr.write(
                    `Invalid span: ${JSON.stringify(span, null, 2)}\n`
                );
                return;
            }

            const gutterWidth = String(endLine + 1).length;
            process.stderr.write(`${this.modulePath}:${startLine + 1}:${span.start.character + 1} - `);
            process.stderr.write(`Error: ${message}\n`);
            process.stderr.write(`${" ".repeat(gutterWidth)} |\n`);

            for (let lineIndex = startLine; lineIndex <= endLine; lineIndex++) {
                const text = lines[lineIndex] ?? "";
                const lineNumber = String(lineIndex + 1).padStart(gutterWidth);

                process.stderr.write(`${lineNumber} | ${text}\n`);

                const marker = this.createMarker(
                    lineIndex,
                    text,
                    span
                );

                process.stderr.write(
                    `${" ".repeat(gutterWidth + 1)} | ${marker}\n`
                );
            }

            process.stderr.write(`${" ".repeat(gutterWidth)} |\n`);
        }

        public createMarker(lineIndex: number, text: string, span: Span): string {
            const startLine = span.start.line;
            const endLine = span.end.line;
            const startColumn = span.start.character;
            const endColumn = span.end.character;

            // Single-line diagnostic
            if (startLine === endLine) {
                return (
                    " ".repeat(startColumn) +
                    "^".repeat(Math.max(1, endColumn - startColumn))
                );
            }

            // First line
            if (lineIndex === startLine) {
                return (
                    " ".repeat(startColumn) +
                    "^".repeat(
                        Math.max(1, text.length - startColumn)
                    )
                );
            }

            // Last line
            if (lineIndex === endLine) {
                return "^".repeat(
                    Math.max(1, Math.min(endColumn, text.length))
                );
            }

            // Middle lines
            return "^".repeat(Math.max(1, text.length));
        }
    };
}