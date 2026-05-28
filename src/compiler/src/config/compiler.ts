import fs from "fs";
import ts from "@/ts";

function run(file: string) {
    const code = fs.readFileSync(file, "utf8");

    const output = ts.transpileModule(code, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS
        }
    });

    return eval(output.outputText);
}

run(process.argv[2]);