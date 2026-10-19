import {TableauConnector} from './tableau-connector.js';
import {buildHierarchy, selectedLeafIds} from './hierarchy.js';

const $ = id => document.getElementById(id);
const status = (message, error=false) => { $('status').textContent=message; $('status').classList.toggle('error',error); };
let tree=null, leaves=[], selected=new Set(), mode='AUSWAHL', busy=false, dirty=false, timer=null, refreshTimer=null, ignoreEvents=false;
const connector=new TableauConnector({
  onDataChanged:()=>{ clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>reload(),450); },
  onModeChanged:v=>{mode=v;summary();}
});
function summary(){ $('count').textContent=`${selected.size} / ${leaves.length} Leaf-IDs`; $('mode').textContent='Modus: '+mode; }
function lock(v){busy=v;for(const id of ['all','none','apply','reload'])$(id).disabled=v;}
function createTree(){
  if (!window.mar10?.Wunderbaum) throw new Error('Lokales Wunderbaum-Skript wurde nicht geladen.');
  ignoreEvents=true;
  try{
    tree?.destroy();
    const {roots}=buildHierarchy(leaves,selected);
    tree=new mar10.Wunderbaum({
      element:$('rows'), source:roots, checkbox:true, selectMode:'hier', icon:false,
      iconMap:{
        ...mar10.Wunderbaum.iconMaps.bootstrap,
        expanderExpanded:'wb-arrow-down',expanderCollapsed:'wb-arrow-right',expanderLazy:'wb-arrow-right',
        checkChecked:'wb-box-checked',checkUnchecked:'wb-box-empty',checkUnknown:'wb-box-partial',
        folder:'',folderOpen:'',doc:''
      },
      select:()=>{
        if(ignoreEvents || busy) return;
        selected=selectedLeafIds(tree);dirty=true;summary();
        clearTimeout(timer);timer=setTimeout(apply,450);
      }
    });
  }finally{ignoreEvents=false;}
  summary();
}
async function reload(force=false){
  if(busy||(dirty&&!force))return;
  lock(true);
  try{
    const state=await connector.readState();
    leaves=state.leaves;selected=state.selectedIds;mode=state.mode;dirty=false;
    createTree();status(`Baum geladen: ${leaves.length} Leaves, ${selected.size} im Set.`);
  }catch(e){status('Leseproblem: '+e.message,true);}
  finally{lock(false);}
}
async function apply(){
  if(busy||!tree)return;
  clearTimeout(timer);lock(true);
  try{
    selected=selectedLeafIds(tree);
    if(selected.size===0){
      await connector.changeMode('KEINE');
      mode='KEINE';status('Keine Auswahl: Modus KEINE (Set bleibt unverändert).');
    }else{
      await connector.changeMode('AUSWAHL');
      mode='AUSWAHL';
      const n=await connector.selectLeaves(selected,leaves);
      status(`${n} Marks an Tableau übergeben. Set Action prüfen.`);
    }
    dirty=false;summary();
  }catch(e){status('Schreibproblem: '+e.message,true);}
  finally{lock(false);}
}
async function setMode(value){
  clearTimeout(timer);if(busy)return;lock(true);
  try{await connector.changeMode(value);mode=value;dirty=false;summary();status('Modus: '+value);}
  catch(e){status('Parameterproblem: '+e.message,true);}
  finally{lock(false);}
}
$('apply').addEventListener('click',apply);
$('reload').addEventListener('click',()=>reload(true));
$('all').addEventListener('click',()=>setMode('ALLE'));
$('none').addEventListener('click',()=>setMode('KEINE'));
try{mode=await connector.initialize();await reload(true);}catch(e){status('Initialisierung: '+e.message,true);}
