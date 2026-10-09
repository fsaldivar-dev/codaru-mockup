import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, node } from '../src/model';
import { defaultDesignTheme } from '../src/themes';
import { exportAsset, prepareAsset } from '../src/asset-export';
import { createEditor } from '../src/editor-core';
import { wrapText, renderScreenToSVG } from '../src/screen-svg';

function fixture() {
  const p=blank(), theme=defaultDesignTheme(); theme.id='brand';theme.name='Brand';theme.modes.light.colors.primary='#1256ab';p.designThemes.brand=theme;
  p.nodes=[node('frame',{id:'screen',role:'screen',name:'Pantalla completa',width:411,height:891,themeId:'brand',fill:'#ff00ff',opacity:80}),node('group',{id:'art',name:'Ilustración móvil',parentId:'screen',x:40,y:100,width:200,height:160}),node('rect',{id:'shape',parentId:'art',x:30,y:20,width:100,height:70}),node('text',{id:'outside',parentId:'screen',x:20,y:600,text:'No exportar este texto'})];
  return p;
}
test('extracts a named transparent asset with inherited tokens, opacity and only its descendants',()=>{
  const p=fixture(),before=structuredClone(p),asset=prepareAsset(p,{ids:['art','shape']});
  assert.equal(asset.name,'ilustracion_movil');assert.equal(asset.width,200);assert.equal(asset.height,160);assert.deepEqual(asset.ids,['art']);
  assert.ok(asset.svg.includes('#1256ab'));assert.ok(asset.svg.includes('opacity="0.8"'));
  assert.ok(!asset.svg.includes('#ff00ff'));assert.ok(!asset.svg.includes('No exportar este texto'));
  assert.deepEqual(p,before);
});
test('selection bounds include overflowing children and shadows; explicit width preserves ratio',()=>{
  const p=fixture();p.nodes[2].x=-25;p.nodes[2].width=260;p.nodes[2].shadow=true;
  const a=prepareAsset(p,{ids:['art']});assert.ok(a.width>260);assert.ok(a.bounds.x<15);
  const b=prepareAsset(p,{ids:['art'],width:160,padding:12,name:'../../12 Asset @ios'});assert.equal(b.width,160);assert.match(b.name,/^asset_12_asset_ios$/);assert.equal(b.height,160*(a.bounds.height+24)/(a.bounds.width+24));
  assert.match(b.svg,/width="160"/);
});
test('asset theme overrides resolve the selected group profile and an explicit mode',()=>{
  const p=fixture(),local=defaultDesignTheme();local.id='local';local.modes.light.colors.primary='#112233';local.modes.dark.colors.primary='#556677';p.designThemes.local=local;p.nodes[1].themeId='local';p.nodes[1].themeMode='light';
  assert.ok(prepareAsset(p,{ids:['art'],theme:{primary:'#ff8800'}}).svg.includes('#ff8800'));
  assert.ok(prepareAsset(p,{ids:['art'],theme:'dark'}).svg.includes('#556677'));
  assert.equal(p.nodes[1].themeMode,'light');
});
test('SVG works without DOM, package rasterization fails clearly and invalid selections are rejected',async()=>{
  const p=fixture();assert.equal(typeof document,'undefined');
  const svg=await exportAsset(p,{ids:['art'],format:'svg'});assert.equal(svg.encoding,'utf8');assert.equal(svg.mime,'image/svg+xml');
  await assert.rejects(exportAsset(p,{ids:['art']}),/WebView/);
  for(const ids of [[],['missing']])assert.throws(()=>prepareAsset(p,{ids}));
  p.nodes[0].hidden=true;assert.throws(()=>prepareAsset(p,{ids:['art']}),/oculto/);
  assert.throws(()=>prepareAsset(fixture(),{ids:['art'],width:Infinity}),/width/);
});
test('core and IA export the current selection without changing document, revision or history',async()=>{
  const editor=createEditor({document:fixture()});editor.select(['art']);
  const before=editor.getState(),context=await editor.agent('context');
  const asset=await editor.exportAsset({format:'svg'});assert.deepEqual(asset.ids,['art']);
  const result=await editor.agent('export',{format:'svg'});assert.equal(result.ok,true);assert.equal(result.revision,context.context!.revision);assert.ok(String(result.content).includes('#1256ab'));
  assert.deepEqual(editor.getState(),before);editor.destroy();
});
test('SVG namespaces differ between themed variants and text indentation is retained',()=>{
  const p=fixture();p.nodes[0].gradient='linear';p.nodes[0].fill='@primary';p.nodes[0].gradientEnd='@primary';
  const a=renderScreenToSVG(p,{theme:{primary:'#ff0000'}}),b=renderScreenToSVG(p,{theme:{primary:'#0000ff'}});
  const ids=(s:string)=>[...s.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.ok(ids(a).length);assert.ok(ids(a).every(id=>!ids(b).includes(id)));
  assert.equal(renderScreenToSVG(p,{theme:{primary:'#ff0000'}}),a);
  assert.deepEqual(wrapText('   Código\n    ',1000,{family:'mono',size:16,weight:400}),['   Código','    ']);
});
