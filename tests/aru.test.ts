import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditor } from '../src/editor-core';
import { node, blank, validate, createComponent, instantiate, type Project } from '../src/model';
import { prepareAruAsset } from '../src/aru';
import type { AruAsset, IllustrationRequest } from '../src/contracts';

const asset = (): AruAsset => ({format:'codaru-aru/1',filename:'musaru.aru',source:'canvas 48 48\ngroup mark { circle disc { at 24 24; radius 18; fill #F1F684 } }',svg:'<svg viewBox="0 0 48 48"><g id="mark"><circle id="disc" cx="24" cy="24" r="18" fill="#F1F684"/></g><script>alert(1)</script></svg>'});
const fixture = () => { const p=blank(); p.nodes=[node('frame',{id:'screen',width:400,height:800})];return p; };
test('ARU authoring source round-trips with SVG, component uses, history and isolated host intents', async () => {
  const requests:IllustrationRequest[]=[];
  const editor=createEditor({document:fixture(),onIllustrationRequest:r=>{requests.push(r);r.source.text='host mutation';}});
  const data=asset();editor.apply([{op:'aru',id:'logo',data,parentId:'screen',width:72}]);data.source='external mutation';
  assert.equal(editor.getDocument().nodes[1].height,72);
  assert.ok(!editor.getDocument().nodes[1].svg!.includes('script'));
  await editor.requestIllustration('logo');assert.equal(requests[0].nodeId,'logo');
  assert.notEqual(editor.getDocument().nodes[1].aruSource!.text,'host mutation');
  editor.commit(p=>{const c=createComponent(p,'logo');instantiate(p,c.id,'screen',100,100);});
  assert.equal(editor.getDocument().nodes.filter(n=>n.aruSource).length,2);
  const restored=validate(JSON.parse(JSON.stringify(editor.getDocument())));
  assert.deepEqual(restored,editor.getDocument());editor.undo();editor.undo();assert.equal(editor.getDocument().nodes.length,1);editor.redo();
  const isolated=createEditor({document:fixture()});assert.equal(isolated.getDocument().nodes.length,1);
  isolated.destroy();editor.destroy();
});
test('replacing ARU retains geometry and compatible animations, SVG replacement clears obsolete source', () => {
  const editor=createEditor({document:fixture()});editor.apply([{op:'aru',id:'logo',data:asset(),parentId:'screen',width:72,x:20,y:30}]);
  const animation={id:'spin',name:'Spin',target:'disc',trigger:'load' as const,duration:2000,delay:0,easing:'linear' as const,iterations:0,alternate:false,keyframes:[{at:0,rotate:0},{at:100,rotate:360}]};
  editor.apply([{op:'update',id:'logo',patch:{animations:[animation,{...animation,id:'whole',target:''}]}}]);
  const edited=asset();edited.svg='<svg viewBox="0 0 100 100"><rect id="new-shape" width="100" height="100" fill="#ff0000"/></svg>';
  editor.apply([{op:'aru',id:'logo',data:edited}]);const n=editor.getDocument().nodes[1];
  assert.deepEqual([n.x,n.y,n.width,n.height],[20,30,72,72]);assert.deepEqual(n.animations?.map(a=>a.id),['whole']);
  editor.apply([{op:'update',id:'logo',patch:{svg:prepareAruAsset(asset()).svg}}]);assert.equal(editor.getDocument().nodes[1].aruSource,undefined);
  editor.undo();assert.equal(editor.getDocument().nodes[1].aruSource!.filename,'musaru.aru');editor.destroy();
});
test('ARU metadata validates on imports and batches, failures roll back and preserve existing v1/v2 documents', async () => {
  const editor=createEditor({document:fixture()});const before=editor.getDocument();
  for(const bad of [{...asset(),format:'other'}, {...asset(),filename:'../evil.aru'}, {...asset(),source:''}, {...asset(),svg:'<img src="bad">'}, {...asset(),source:'a'.repeat(400001)}]){
    assert.throws(()=>editor.apply([{op:'update',id:'screen',patch:{name:'rollback'}},{op:'aru',data:bad as AruAsset}]));assert.deepEqual(editor.getDocument(),before);
  }
  assert.throws(()=>editor.apply([{op:'aru',id:'screen',data:asset()}]));
  const bad=structuredClone(before);bad.nodes[0].aruSource={version:1,text:'canvas 1 1',filename:'bad.aru'};assert.throws(()=>validate(bad));
  const legacy={...structuredClone(before),version:1};assert.equal(validate(legacy).version,2);
  const ctx=await editor.agent('context');const revision=ctx.context!.revision;
  const dry=await editor.agent('apply',{expectedRevision:revision,operations:[{op:'aru',id:'logo',data:asset(),parentId:'screen'}],dryRun:true});assert.equal(dry.ok,true);assert.deepEqual(editor.getDocument(),before);
  assert.equal((await editor.agent('apply',{expectedRevision:revision,operations:[{op:'aru',id:'logo',data:asset(),parentId:'screen'}]})).ok,true);
  const context=await editor.agent('context',{scope:'logo'});assert.equal((context.context!.nodes as any[])[0].illustration.sourceLength,asset().source.length);assert.ok(!JSON.stringify(context).includes(asset().source));
  const exported=await editor.agent('export',{format:'aru',ids:['logo']});assert.equal(exported.content,asset().source);
  assert.equal((await editor.agent('export',{format:'aru',ids:['screen','logo']})).ok,false);
  await assert.rejects(editor.requestIllustration('logo'),/IDE/);editor.destroy();
});
