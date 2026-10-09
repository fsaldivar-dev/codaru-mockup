#!/usr/bin/env node
// Optional authoring tool. Neither ARU nor Sharp is linked into the Codaru runtime.
import { readFile, writeFile, mkdtemp, rm, realpath, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args[0] === '--help' || !args.length) {
  console.log('Uso: codaru-aru ilustracion.aru --out ilustracion.aru.codaru.json [--aru /ruta/aru]\nRequiere @fsaldivar.dev/aru@0.7.0. Compila el SVG y conserva el fuente editable.\nImporta el resultado desde Ilustración o úsalo como data en la operación aru.\nNo reemplaza archivos existentes. No necesita un servidor.');
  process.exit(args.length ? 0 : 1);
}
let temp;
try {
  const input = args.shift(); let output, executable;
  while (args.length) {
    const key = args.shift(), value = args.shift();
    if (!value || !['--out','--aru'].includes(key)) throw new Error('Consulta codaru-aru --help.');
    if (key === '--out') { if(output)throw new Error('--out repetido.'); output=value; }
    else { if(executable)throw new Error('--aru repetido.'); executable=value; }
  }
  if (!output || !/\.aru$/i.test(input)) throw new Error('Indica un fuente .aru y --out.');
  const source = await readFile(resolve(input),'utf8');
  if (!source.trim() || source.length>400_000) throw new Error('El fuente debe contener texto y ocupar hasta 400 kB.');
  if (!executable) {
    const sibling = join(dirname(await realpath(process.execPath)), 'aru');
    executable = await access(sibling).then(()=>sibling,()=> 'aru');
  }
  temp = await mkdtemp(join(tmpdir(),'codaru-aru-'));
  // Compile the captured source, not a file that a human may edit between two CLI calls.
  const captured = join(temp,'source.aru'); await writeFile(captured,source,{flag:'wx'});
  const inspection = spawnSync(executable,['context',captured],{encoding:'utf8',timeout:60_000,maxBuffer:4_000_000,shell:false});
  if(inspection.error || inspection.status!==0)throw new Error(`ARU no pudo validar el fuente: ${inspection.error?.message || inspection.stderr || inspection.stdout}`);
  const context=JSON.parse(inspection.stdout);
  if(context.warnings?.length)throw new Error(`Revisa los avisos de ARU antes de importar: ${context.warnings.map(w=>w.message).join('; ')}`);
  const rendered = join(temp,'illustration.svg');
  const result = spawnSync(executable,['render',captured,'--out',rendered],{encoding:'utf8',timeout:60_000,maxBuffer:1_000_000,shell:false});
  if(result.error) throw new Error(`No se pudo ejecutar ARU: ${result.error.message}. Usa --aru /ruta/aru.`);
  if(result.status!==0) throw new Error(`ARU rechazó el dibujo: ${result.stderr || result.stdout}`);
  const svg=await readFile(rendered,'utf8');
  if(svg.length>400_000) throw new Error('El SVG supera 400 kB; simplifica el dibujo.');
  const filename=basename(input);
  if(!/^[^/\\\u0000-\u001f<>:"|?*]{1,120}\.aru$/i.test(filename))throw new Error('Nombre .aru inválido.');
  await writeFile(resolve(output),JSON.stringify({format:'codaru-aru/1',source,svg,filename},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({ok:true,file:resolve(output),filename,next:'Importa el paquete en Codaru o envíalo como data de una operación aru; consulta context para conocer las capas animables.'}));
} catch(error) { console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1; }
finally { if(temp)await rm(temp,{recursive:true,force:true}); }
