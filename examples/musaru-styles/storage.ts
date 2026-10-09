// Persistence belongs to this example host, never to the embedded editor runtime.
import type { Project } from '../../src/model';
const database=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open('codaru-musaru-style-lab',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('projects');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
export async function readSaved():Promise<unknown>{
  const db=await database;return new Promise((resolve,reject)=>{const request=db.transaction('projects').objectStore('projects').get('document');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
}
let latest:Project|undefined,running:Promise<void>|undefined;
async function drain(){
  const db=await database;
  while(latest){const snapshot=latest;latest=undefined;await new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(snapshot,'document');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
}
export function save(document:Project):Promise<void>{
  latest=document;
  if(!running)running=drain().finally(()=>{running=undefined;});
  return running;
}
