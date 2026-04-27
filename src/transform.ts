import { init, parse } from "es-module-lexer"
import MagicString from "magic-string"
import esbuild from "esbuild"

await init

/**
 * @summary Transforms a single JS file. Uses ESBuild to convert .ts and CommonJS to ES Module JS.
 * @param source Raw JS source file contents
 * @param filename The filename
 * @returns 
 */
export async function transformImports(source: string, filename: string) {

    // 1. Transpile (esbuild)
    const { code: jsCode } = await esbuild.transform(source, {
        loader: filename.endsWith('.ts') ? 'ts' : 'js',
        define: { 'process.env.NODE_ENV': '"development"' },
        format: 'esm',
    });

    const [imports] = parse(jsCode)
    const s = new MagicString(jsCode)

    for (const imp of imports) {
        const { s: start, e: end, n: specifier } = imp;
        if (specifier === undefined) continue;

        if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
            const replacedUrl = `/@modules/${specifier}/`;
            s.overwrite(start, end, replacedUrl);
        }
    }

    const result = s.toString()
    return result
}