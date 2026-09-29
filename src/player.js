import {makeActive,ACTIVE_LIMIT,JOBS} from './population.js';
import {ACTIONS} from './brain.js';
export function createPlayer(w,{name,age=25,job=0,clothes='#58b9dd',skin='#c58d63'}){
 name=String(name||'').trim();if(!name||name.length>60)throw Error('Enter a name between 1 and 60 characters.');
 if(w.player)throw Error('Your character already lives in this city.');if(w.citizens.length>=ACTIVE_LIMIT)throw Error('This city has reached its active resident limit.');
 if(!Number.isInteger(age)||age<18||age>90)throw Error('Choose an adult age from 18 to 90.');
 if(!JOBS[job]||!/^#[0-9a-f]{6}$/i.test(clothes)||!/^#[0-9a-f]{6}$/i.test(skin))throw Error('Choose a valid appearance and job.');
 const id=w.nextId++,a=makeActive(1,w.population?.seed||1,w.minutes);Object.assign(a,{id,name,age,job:{...JOBS[job]},role:JOBS[job].title,clothes,skin,parents:[],children:[],friends:[],partner:null,relations:{},goal:'Build a life of my own',generation:1,memories:[{time:w.minutes,text:'I moved to Free City.'}],action:'Idle',thought:'My life starts here.',wealth:150});w.citizens.push(a);w.player={id,controlled:true,command:null,move:{x:0,z:0}};return a;
}
export function commandPlayer(w,action){const a=w.citizens.find(a=>a.id===w.player?.id);if(!a||a.health<=0)throw Error('You need a living character first.');if(!w.player.controlled)throw Error('Take control of your character first.');if(!ACTIONS.includes(action)||action==='School')throw Error('Unknown player action.');w.player.move={x:0,z:0};w.player.command=action;return a;}
export function controlPlayer(w,on){if(!w.player)return;w.player.controlled=!!on;w.player.command=null;w.player.move={x:0,z:0};const a=w.citizens.find(a=>a.id===w.player.id);if(a?.life)a.life.plan=null;}
