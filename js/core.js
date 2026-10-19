export function normalizeId(v){return v == null ? '' : String(v).trim();}
export function membership(value){
 if(typeof value==='boolean')return value;
 if(typeof value==='number')return value===1?true:value===0?false:null;
 const v=String(value??'').trim().toUpperCase();
 if(['IN','TRUE','WAHR','1','IM SET'].includes(v))return true;
 if(['OUT','FALSE','FALSCH','0','AUSSERHALB DES SETS','NICHT IM SET'].includes(v))return false;
 return null;
}
export function rowToLeaf(row, encodingMap, tupleId){
 const field=encodingMap.leaf?.[0]?.name;
 if(!field)throw new Error('Leaf ID fehlt.');
 const id=normalizeId(row[field]?.value);
 if(!id)throw new Error('Leere Leaf-ID in Zeile '+tupleId);
 const levels=(encodingMap.level??[]).map(f=>normalizeId(row[f.name]?.formattedValue??row[f.name]?.value)).filter(Boolean);
 const raw=encodingMap.membership?.[0] ? row[encodingMap.membership[0].name] : null;
 let inSet=raw ? membership(raw.value) : null;
 if(inSet===null && raw)inSet=membership(raw.formattedValue);
 return {id,levels,path:levels.join(' › '),tupleId,inSet};
}
export function readLeafSelection(leaves){
 const selected=new Set();
 for(const leaf of leaves){if(leaf.inSet===null)throw new Error('Set-Mitgliedschaft von '+leaf.id+' unlesbar.');if(leaf.inSet)selected.add(leaf.id);}
 return selected;
}
export function validateLeaves(leaves){
 const seen=new Set();
 for(const leaf of leaves){if(seen.has(leaf.id))throw new Error('Leaf-ID '+leaf.id+' mehrfach.');seen.add(leaf.id);}
}
