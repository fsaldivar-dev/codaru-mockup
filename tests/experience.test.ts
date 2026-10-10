import test from 'node:test';
import assert from 'node:assert/strict';
import {createEditor,getEditorSession} from '../src/editor-core';
import {blank,node,createComponent,instantiate,subtree,clone,validate,duplicate} from '../src/model';
import {experienceReport} from '../src/experience';
import type {ExperienceSpec} from '../src/contracts';
import {localizeProject} from '../src/localization';
const spec:ExperienceSpec={accessibility:{role:'button',name:'Reproducir',nameKey:'player.play',keyboard:['Enter','Space'],focus:'visible',states:['disabled','busy']},testId:'play-track',analytics:[{name:'player.track.play',trigger:'success',purpose:'Medir reproducciones confirmadas',consent:'required',properties:{track_id:{type:'string',source:'track.id'}}}],acceptance:['No emitir éxito si la carga falla']};
function fixture(){const p=blank();p.nodes=[node('frame',{id:'screen',name:'Reproductor',role:'screen',width:390,height:800}),node('button',{id:'play',name:'Play',parentId:'screen',text:'Play',width:100,height:48}),node('input',{id:'search',name:'Buscar',parentId:'screen',text:'Placeholder',y:100,width:320,height:44}),node('rect',{id:'other',name:'Otra capa',parentId:'screen',y:250})];return p;}
test('contracts are atomic, persisted, undoable, isolated and backward compatible',()=>{
 const p=fixture(),editor=createEditor({document:p}),other=createEditor({document:p});
 editor.setExperience('play',spec);spec.accessibility!.name='Mutación externa';assert.equal(editor.getDocument().nodes[1].experience!.accessibility!.name,'Reproducir');spec.accessibility!.name='Reproducir';
 assert.equal(other.getDocument().nodes[1].experience,undefined);
 assert.deepEqual(validate(JSON.parse(JSON.stringify(editor.getDocument()))),editor.getDocument());
 const legacy=clone(p) as any;legacy.version=1;delete legacy.designThemes;delete legacy.activeThemeId;assert.equal(validate(legacy).version,2);assert.equal(validate(legacy).nodes[1].experience,undefined);
 editor.undo();assert.equal(editor.getDocument().nodes[1].experience,undefined);editor.redo();assert.equal(editor.getDocument().nodes[1].experience!.testId,'play-track');
 const before=editor.getDocument();for(const bad of [{testId:'__proto__'},{accessibility:{role:'bogus'}},{analytics:[{name:'a',trigger:'success',purpose:'ok',properties:{p:{type:'string',source:'x',sample:'private'}}}]},{analytics:[spec.analytics![0],spec.analytics![0]]},{accessibility:{focusOrder:NaN}},{accessibility:{keyboard:['Enter','Enter']}},{accessibility:{name:'a\nb'}},{unexpected:true}])assert.throws(()=>editor.apply([{op:'update',id:'other',patch:{width:500}},{op:'experience.set',id:'play',spec:bad as any}]));
 assert.deepEqual(editor.getDocument(),before);editor.setExperience('play',null);assert.equal(editor.getDocument().nodes[1].experience,undefined);editor.destroy();other.destroy();
});
test('masters propagate contracts; instance overrides, duplicate warnings and templates survive round trip',()=>{
 const p=fixture();p.nodes[1].experience=clone(spec);const component=createComponent(p,'play').id,first=instantiate(p,component,'screen',120,400),second=instantiate(p,component,'screen',120,500);const editor=createEditor({document:p});
 editor.setExperience(first,{accessibility:{role:'button',name:'Solo aquí'},testId:'unique-play',analytics:[]});editor.setExperience('play',{accessibility:{role:'button',name:'En maestro'},analytics:[]});
 assert.equal(editor.getDocument().nodes.find(n=>n.id===first)!.experience!.accessibility!.name,'Solo aquí');assert.equal(editor.getDocument().nodes.find(n=>n.id===second)!.experience!.accessibility!.name,'En maestro');
 assert.ok(editor.getDocument().nodes.find(n=>n.id===first)!.overrides!.includes('experience'));
 editor.commit(p=>duplicate(p,[first]));assert.ok(editor.getExperienceReport({ids:[first]}).issues.some(i=>i.rule==='test-id-duplicate'));assert.ok(subtree(validate(editor.getDocument()),first)[0].experience);editor.destroy();
});
test('handoff has exact revision, scoped instrumentation and honest automated/manual checks without side effects',async()=>{
 const p=fixture();p.nodes[1].experience=clone(spec);p.nodes[2].experience={accessibility:{role:'textbox',nameKey:'search.label',keyboard:['Tab'],focus:'visible'},analytics:[]};const editor=createEditor({document:p});const before=editor.getState(),ctx=await editor.agent('context');
 const report=editor.getExperienceReport({ids:['play']});assert.equal(report.revision,ctx.context!.revision);assert.equal(report.entries.length,1);assert.ok(report.entries[0].instrumentation[0].where.includes('resultado exitoso'));assert.ok(!report.entries[0].instrumentation[0].where.includes('manejador de activación'));assert.equal(report.entries[0].tests.bindings.ios,'accessibilityIdentifier=play-track');assert.ok(report.entries[0].tests.assertions.some(a=>a.kind==='analytics'&&a.verification==='automated'));assert.ok(report.runtimeChecks.length>=4);assert.deepEqual(editor.getState(),before);
 report.entries[0].spec.testId='Mutar';assert.equal(editor.getExperienceReport({ids:['play']}).entries[0].spec.testId,'play-track');
 assert.ok(editor.getExperienceReport({ids:['search']}).issues.every(i=>i.rule!=='analytics-placement'));assert.throws(()=>experienceReport(p,{ids:['absent']}));assert.throws(()=>experienceReport(p,{frameId:'absent'}));
 const localized=localizeProject(p,{locale:'en',messages:{en:{'player.play':'Play track','search.label':'Search tracks'}},labels:{}});assert.equal(localized.nodes[1].experience!.accessibility!.name,'Play track');assert.equal(p.nodes[1].experience!.accessibility!.name,'Reproducir');editor.destroy();
});
test('review detects schema conflicts, sensitive definitions, decorative controls and duplicate locators across scope',()=>{
 const p=fixture();p.nodes[1].experience=clone(spec);p.nodes[2].experience={testId:'play-track',accessibility:{role:'textbox',decorative:true,focusOrder:1},analytics:[{...spec.analytics![0],properties:{track_id:{type:'number',source:'track.id',sensitive:true}}}]};p.nodes[1].experience!.accessibility!.focusOrder=1;
 const rules=experienceReport(p,{ids:['search']}).issues.map(i=>i.rule);for(const rule of ['test-id-duplicate','focus-order-duplicate','decorative-control','keyboard-focus','analytics-schema','analytics-sensitive'])assert.ok(rules.includes(rule),rule);
 p.nodes[2].experience={testId:'codaru-play'};assert.ok(experienceReport(p,{ids:['play']}).issues.every(i=>i.rule!=='test-id-duplicate'));delete p.nodes[1].experience;assert.ok(experienceReport(p,{ids:['play']}).issues.some(i=>i.rule==='test-id-duplicate'));
});
test('agent exposes bounded context, exact report, dry run, conflicts and editor busy protection',async()=>{
 const editor=createEditor({document:fixture()}),ctx=await editor.agent('context');const batch={expectedRevision:ctx.context!.revision,operations:[{op:'experience.set',id:'play',spec}]};
 assert.ok(JSON.stringify(await editor.agent('schema')).includes('experience.set'));assert.equal((await editor.agent('apply',{...batch,dryRun:true})).ok,true);assert.equal(editor.getDocument().nodes[1].experience,undefined);assert.equal((await editor.agent('apply',batch)).ok,true);assert.equal((await editor.agent('apply',batch)).error!.code,'revision_conflict');
 const report=await editor.agent('experience',{ids:['play']});assert.equal((report.report as any).entries[0].spec.testId,'play-track');const selection=await editor.agent('context',{scope:'other',depth:0});assert.ok(!JSON.stringify(selection).includes('player.track.play'));
 editor.setExperience('play',{accessibility:{nameKey:'k'.repeat(300)},analytics:[{name:'long.purpose',trigger:'press',purpose:'p'.repeat(300)}]});const bounded=((await editor.agent('context',{scope:'play',depth:0})).context as any).nodes[0];assert.equal(bounded.experience.truncated,true);assert.equal(bounded.experience.analytics[0].purpose.length,240);assert.equal(bounded.experience.accessibility.nameKey.length,240);
 const unbind=getEditorSession(editor).bindExtension({flush(){},dispose(){},isBusy:()=>true});assert.equal((await editor.agent('apply',{...batch,expectedRevision:(await editor.agent('context')).context!.revision})).error!.code,'editor_busy');unbind();editor.destroy();
});
