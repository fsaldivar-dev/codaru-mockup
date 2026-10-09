import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const adapters = new Set(['embed', 'modular', 'editor-runtime', 'view-dom', 'main', 'ui-theme', 'component-properties-view', 'implementations-view', 'resource-preview', 'resource-library-view', 'style-package-view', 'identity-view', 'identity-preview', 'comments-view']);

function imports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) found.push(node.moduleSpecifier.text);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) found.push(node.argument.literal.text);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) found.push(node.moduleReference.expression.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      assert.ok(node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]), `${relative(src, file)}: lazy imports must name a module so the architecture check can follow it.`);
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source); return found;
}

test('the headless dependency graph cannot pull in UI adapters, styles, native SDKs or runtime packages', () => {
  const seen = new Set<string>();
  function visit(file: string, chain: string[]) {
    if (seen.has(file)) return;
    seen.add(file);
    for (const specifier of imports(file)) {
      const route = [...chain, specifier].join(' → ');
      assert.ok(specifier.startsWith('.'), `${route}: the host provides external services; keep runtime dependencies out of the core.`);
      assert.ok(!/\.(css|html)(?:[?#]|$)/.test(specifier), `${route}: styles and HTML belong to view adapters.`);
      const target = resolve(dirname(file), specifier), name = relative(src, target).replace(/\.[cm]?tsx?$/, '');
      assert.ok(!name.startsWith('..'), `${route}: core dependencies must stay inside src.`);
      assert.ok(!adapters.has(name), `${route}: move shared types to contracts.ts; the core must not depend on an adapter.`);
      const resolved = [target, `${target}.ts`, resolve(target, 'index.ts')].find(p => p.endsWith('.ts') && existsSync(p));
      if (resolved) visit(resolved, [...chain, specifier]);
    }
  }
  visit(resolve(src, 'editor-core.ts'), ['editor-core']);
});

test('shared contracts erase completely and cannot initialize a runtime or take ownership of host resources', () => {
  const file = resolve(src, 'contracts.ts');
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const parsed = ts.createSourceFile('contracts.js', output, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.ok(parsed.statements.every(node => ts.isExportDeclaration(node) && !node.moduleSpecifier && node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length === 0), 'contracts.ts must contain only erased types; behavior belongs in the core or a specific adapter.');
});
