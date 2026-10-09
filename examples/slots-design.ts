import { blank, node, createComponent, instantiate, updateNode, syncComponents, validate } from '../src/model';
import { defineComponentProperty, setComponentProperty } from '../src/component-properties';
export function slotsDesign() {
  const p=blank();p.name='Slots · Una tarjeta, tres contenidos';p.pages=[{id:'main',name:'Composición'},{id:'masters',name:'Maestro de tarjeta'}];p.activePageId='main';
  p.nodes.push(node('frame',{id:'library',name:'Contenidos reutilizables',role:'library',x:30,y:30,width:320,height:570,fill:'#ffffff'}),node('frame',{id:'screen',name:'Mi espacio · Instancias',role:'screen',x:405,y:30,width:390,height:570,fill:'#f5f5fa'}),node('frame',{id:'master-sheet',name:'Maestro de tarjeta',page:'masters',role:'library',width:390,height:400,fill:'#ffffff'}));
  const text=(id:string,parentId:string,label:string,x:number,y:number,width:number,size=14)=>node('text',{id,parentId,name:id.endsWith('-label')?'Label':id,text:label,x,y,width,height:size*1.6,fontSize:size,fontWeight:600,color:'#282536'});
  p.nodes.push(text('library-title','library','Tres formas de presentarte',22,24,276,20),text('library-note','library','Contenido propio. Un mismo espacio.',22,65,276,12));
  const configs=[{id:'avatar',name:'Avatar',label:'Alex Morgan',caption:'Diseñador de producto',fill:'#f2eefb',y:136},{id:'logo',name:'Logo',label:'Forma Studio',caption:'Ideas que toman forma',fill:'#ece7fa',y:285},{id:'status',name:'Estado',label:'Disponible',caption:'Listo para tu próximo proyecto',fill:'#e7f3ed',y:434}];
  const choices:Record<string,string>={};
  for(const config of configs){
    p.nodes.push(text(config.id+'-caption','library',config.name.toUpperCase(),22,config.y-28,260,11),node('group',{id:config.id,name:config.name,parentId:'library',x:22,y:config.y,width:276,height:82,fill:config.fill,radius:14}),text(config.id+'-label',config.id,config.label,70,16,192,16),text(config.id+'-note',config.id,config.caption,70,45,192,10));
    p.nodes.find(n=>n.id===config.id+'-label')!.textKey=`header.${config.id}`;
    p.nodes.push(node(config.id==='avatar'?'ellipse':'rect',{id:config.id+'-mark',parentId:config.id,name:'Marca',x:16,y:20,width:42,height:42,fill:config.id==='status'?'#267658':'#7955db',radius:config.id==='avatar'?21:12}));
    if(config.id==='avatar')p.nodes.push(text('avatar-initials','avatar','AM',24,30,28,14));
    else p.nodes.push(node('icon',{id:config.id+'-icon',parentId:config.id,name:'Símbolo',x:26,y:30,width:22,height:22,iconPack:'web',iconName:config.id==='logo'?'star':'check',color:'#ffffff',fill:'transparent'}));
    if(config.id==='avatar')p.nodes.find(n=>n.id==='avatar-initials')!.color='#ffffff';
    choices[config.id]=createComponent(p,config.id).id;
  }
  p.nodes.push(text('screen-title','screen','Tu espacio, a tu manera',24,24,342,24),text('screen-note','screen','Una tarjeta. Contenidos intercambiables.',24,69,342,12));
  p.nodes.push(node('group',{id:'card',name:'Tarjeta',parentId:'master-sheet',x:30,y:70,width:330,height:208,fill:'#ffffff',stroke:'#e2deed',strokeWidth:1,radius:18}));
  const slot=instantiate(p,choices.avatar,'card',18,18);updateNode(p,slot,{name:'Cabecera',width:294,height:82});
  p.nodes.push(text('card-title','card','Tu próximo proyecto',18,120,294,18),text('card-note','card','La estructura se comparte. El contenido es tuyo.',18,156,294,11));
  const card=createComponent(p,'card').id;
  defineComponentProperty(p,card,'cabecera',{type:'slot',targetId:slot,label:'Cabecera',allowedComponents:Object.values(choices)});
  defineComponentProperty(p,card,'titulo',{type:'text',targetId:'card-title',label:'Título'});
  const first=instantiate(p,card,'screen',30,113),second=instantiate(p,card,'screen',30,343);
  setComponentProperty(p,first,'titulo','Proyecto Aurora');setComponentProperty(p,second,'titulo','Proyecto Bosque');setComponentProperty(p,second,'cabecera',choices.logo);
  syncComponents(p);return {document:validate(p),ids:{card,slot,first,second,avatar:choices.avatar,logo:choices.logo,status:choices.status}};
}
