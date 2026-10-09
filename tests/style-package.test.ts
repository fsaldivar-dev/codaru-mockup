import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, node, Store, clone, validate } from '../src/model';
import { createEditor } from '../src/editor-core';
import { defaultDesignTheme, effectiveTheme } from '../src/themes';
import { parseStylePackage, importStylePackage, applyStylePackage } from '../src/style-package';
import type { DesignStylePackage } from '../src/contracts';

const style=():DesignStylePackage=>({format:'codaru-style/1',id:'print-studio',name:'Estudio impreso',version:'1.0',description:'Composición editorial con tinta y papel.',theme:defaultDesignTheme('print-studio','Estudio impreso'),guidance:{composition:['Columnas asimétricas con titulares grandes'],typography:['Jerarquía serif y anotaciones mono'],controls:['Controles planos como fichas impresas'],mobile:['Portada vertical con navegación por índice, sin sidebar reducida'],motion:['Cambios de página breves'],avoid:['Tarjetas idénticas y barras flotantes genéricas']},aru:{palette:['#212120','#f5eddc'],instructions:['Trazos de tinta irregular y siluetas legibles a 24 px']}});

test('portable styles preserve gradients and mobile/ARU guidance, reject scripts and invalid aliases',()=>{
 const input=style(),parsed=parseStylePackage(input);input.guidance.mobile[0]='outside';assert.match(parsed.guidance.mobile[0],/Portada/);
 assert.equal(parsed.theme.modes.light.gradients.brand.stops.length,2);
 assert.throws(()=>parseStylePackage({...style(),script:'run()'}),/inválido/);
 assert.throws(()=>parseStylePackage({...style(),id:'__proto__'}),/inválido/);
 const alias=style();alias.theme.modes.dark.colors.primary='@missing';assert.throws(()=>parseStylePackage(alias),/encontrado|referencia|Alias/i);
 const gradient=style();gradient.theme.modes.light.gradients.brand.stops[0].position=110;assert.throws(()=>parseStylePackage(gradient));
 assert.throws(()=>parseStylePackage({...style(),aru:{palette:['url(js)'],instructions:[]}}),/ARU/);
});

test('style import and frame-scoped tokens are undoable, preserve layout and survive v1/v2 reads',()=>{
 const p=blank();p.nodes=[node('frame',{id:'one'}),node('frame',{id:'two',x:600}),node('button',{id:'button',parentId:'one',fill:'@primary'})];
 const s=new Store(p);s.commit(p=>importStylePackage(p,style()));const imported=clone(s.project);
 s.commit(p=>applyStylePackage(p,'print-studio','one','dark'));
 assert.equal(effectiveTheme(s.project,s.project.nodes[2]).id,'style-print-studio');assert.equal(effectiveTheme(s.project,s.project.nodes[1]).id,'project');
 assert.deepEqual(s.project.nodes.map(({themeId,themeMode,...n})=>n),imported.nodes.map(({themeId,themeMode,...n})=>n));
 assert.deepEqual(validate(JSON.parse(JSON.stringify(s.project))),s.project);
 assert.equal(validate({...imported,version:1}).stylePackages?.['print-studio'].guidance.mobile.length,1);
 s.undo();assert.deepEqual(s.project,imported);s.undo();assert.deepEqual(s.project,p);
});

test('headless and agent style operations are atomic, discoverable, scoped and isolated',async()=>{
 const p=blank();p.nodes=[node('frame',{id:'screen'})];const editor=createEditor({document:p}),other=createEditor({document:p});
 const c:any=await editor.agent('context');const operations=[{op:'style.import',data:style()},{op:'style.apply',id:'print-studio',frameId:'screen'}];
 const dry:any=await editor.agent('apply',{expectedRevision:c.context.revision,operations,dryRun:true});assert.equal(dry.ok,true);assert.equal(editor.getStyles().length,0);
 const applied:any=await editor.agent('apply',{expectedRevision:c.context.revision,operations});assert.equal(applied.ok,true,JSON.stringify(applied));
 assert.match(applied.context.styleGuidance.mobile[0],/Portada/);assert.equal(other.getStyles().length,0);
 const cat:any=await editor.agent('catalog',{kind:'styles',kit:'print-studio'});assert.equal(cat.style.aru.palette.length,2);
 editor.undo();assert.equal(editor.getStyles().length,0);assert.equal(editor.getDocument().nodes[0].themeId,undefined);
 editor.importStyle(style());const before=editor.getDocument();
 assert.throws(()=>editor.applyStyle('print-studio',{frameId:''}),/Pantalla/);assert.deepEqual(editor.getDocument(),before);
 assert.throws(()=>editor.apply([{op:'style.apply',id:'print-studio'},{op:'update',id:'missing',patch:{x:1}}]));assert.deepEqual(editor.getDocument(),before);
 editor.destroy();other.destroy();
});

test('scoped agent context bounds style prose and points to the complete catalogue',async()=>{
 const editor=createEditor(),long=style();long.description='d'.repeat(2000);long.guidance.mobile=Array.from({length:24},()=> 'm'.repeat(1200));
 editor.importStyle(long);editor.applyStyle(long.id);
 const result:any=await editor.agent('context');assert.equal(result.context.styleGuidance.mobile.length,4);assert.equal(result.context.styleGuidance.mobile[0].length,240);assert.equal(result.context.styleGuidanceTruncated,true);assert.equal(result.context.styles[0].textTruncated,true);
 const full:any=await editor.agent('catalog',{kind:'styles',kit:long.id});assert.equal(full.style.guidance.mobile[0].length,1200);editor.destroy();
});
