import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../../', import.meta.url));
const modules = new Map();
async function compile(file) {
  if (modules.has(file)) return modules.get(file);
  const source = await readFile(file, 'utf8');
  let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const imports = [...output.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)];
  for (const match of imports) {
    const specifier = match[1];
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    const target = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
    const uri = await compile(target.endsWith('.ts') ? target : target + '.ts');
    output = output.replaceAll('"' + specifier + '"', '"' + uri + '"').replaceAll("'" + specifier + "'", '"' + uri + '"');
  }
  const uri = 'data:text/javascript;base64,' + Buffer.from(output).toString('base64');
  modules.set(file, uri);
  return uri;
}
export async function loadTs(relative) { return import(await compile(path.join(root, relative))); }
