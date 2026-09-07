import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

// Let Node run the same TypeScript/TSX modules and aliases used by Next.js.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith("@/")) {
            const path = new URL(`../${specifier.slice(2)}`, import.meta.url);
            const extension = existsSync(new URL(`${path.href}.tsx`)) ? ".tsx" : ".ts";
            return nextResolve(path.href + extension, context);
        }
        if (specifier.startsWith(".")) {
            const path = new URL(specifier, context.parentURL);
            if (existsSync(new URL(`${path.href}.ts`))) return nextResolve(`${path.href}.ts`, context);
        }
        return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
        if (url.endsWith(".tsx")) {
            const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
                compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
            }).outputText;
            return { format: "module", source, shortCircuit: true };
        }
        return nextLoad(url, context);
    },
});
