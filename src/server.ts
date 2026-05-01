#!/usr/bin/env node
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { transformImports } from './transform.ts';

const args = process.argv.slice(2);
const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] ?? '3000');
const customRoot = args.find(a => !a.startsWith('--')) ?? '.';
const root = path.resolve(process.cwd(), customRoot);
const version = "0.0.0"

const MIME_TYPES: Record<string, string | undefined> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
};

const server = http.createServer(async (req, res) => {
    const url = req.url!
    const filePath = path.join(root, url === '/' ? 'index.html' : url!);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    try {
        if (url.startsWith('/@modules/')) {
            const targetPath = await resolvePackage(url);
            let content = await readFile(targetPath, 'utf-8');
            content = await transformImports(content, targetPath);
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            return res.end(content);
        }

        let content = await readFile(filePath, "utf-8");
        if (ext === ".js" || ext === ".ts") {
            content = await transformImports(content, filePath)
        }

        if (ext === ".css") {
            content = `
            const style = document.createElement('style');
            style.textContent = ${JSON.stringify(content)};
            document.head.appendChild(style);
            `
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            console.error(`\x1b[31m[404]\x1b[0m ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404 Not Found');
        }
        console.error(`\x1b[31m[500] Build Error:\x1b[0m\n${err.stack || err.message}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Internal Server Error:\n${err.message}`);
    }
});

server.listen(port, () => {
    console.clear();
    console.log(`\x1b[32m Ryan ESM Dev Server v${version}\x1b[0m`);
    console.log(`\n\x1b[0m Running locally on: \x1b[36mhttp://localhost:${port}/\x1b[0m`);
});

process.on('SIGINT', () => {
    server.close(() => {
        console.log('\nServer closed. Later!\n');
        process.exit(0);
    });
});

async function resolvePackage(url: string) {
    const parts = url.replace('/@modules/', '').split('/');
    const isScoped = parts[0].startsWith("@");
    const pkgName = isScoped ? `${parts[0]}/${parts[1]}` : parts[0];
    const subPath = parts.slice(isScoped ? 2 : 1).join('/');

    const pkgRoot = path.resolve(process.cwd(), 'node_modules', pkgName);

    let targetPath: string;
    if (subPath) {
        targetPath = path.join(pkgRoot, subPath);
    } else {
        const pkgJson = JSON.parse(await readFile(path.join(pkgRoot, 'package.json'), 'utf-8'));
        const entry = pkgJson.module || pkgJson.main || 'index.js';
        targetPath = path.join(pkgRoot, entry);
    }

    console.log({ pkgName, subPath, pkgRoot, url })

    return targetPath
}
