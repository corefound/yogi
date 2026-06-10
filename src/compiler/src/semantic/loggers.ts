import { BaseSemantic, Constructor } from "./base";
import ts from "../ts";
import { Kinds } from "../helpers/types";
import { Helpers } from "../helpers";

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
            const span: Span = {
                start: position,
                end: {
                    line: position.line,
                    character: position.character + 1,
                },
            };

            this.printSpan(span, sourceText, String(kind), {
                ...context,
                lineOffset: context.position.line
            });
            console.log(endMessage);
            process.exit(1);
        }

        public printSpan(span: Span, sourceText: string, message: string, options: any): void {
            const errorColumn = span.start.character;

            process.stderr.write(
                `${this.modulePath.absolutePath} at ${span.start.line + 1}:${errorColumn + 1} - Error: ${message}\n`
            );

            process.stderr.write(`${sourceText}\n`);

            if (options?.help) {
                process.stderr.write(`  = ${options.help}\n`);
            }
        }
    };
}