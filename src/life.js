import {cityDestination,routineFor,sleepTime,CITY_BOUNDS} from "./city-life.js";
import {talk,attemptTheft} from "./social-life.js";
import {newBrain,learn,ACTIONS} from './brain.js';
import {decisionNetwork} from './decisions.js';
export const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const durations={Eat:20,Rest:240,Work:120,Socialize:50,Explore:45,Family:90,School:120,Play:75,Research:90,Clinic:50,Solitude:90,Theft:10,Travel:1};
export function rememberLife(w,a,text){a.memories.unshift({time:w.minutes,text});a.memories.length=Math.min(40,a.memories.length);}
function note(w,text){w.events.unshift({time:w.minutes,text});w.events.length=Math.min(100,w.events.length);}
export function ensureLife(a,rand){if(!a.brain)a.brain=newBrain(rand);if(!a.life)a.life={loneliness:.2+rand()*.4,boredom:.15+rand()*.5,stress:.15,satisfaction:.5,recent:{},plan:null,history:[],thoughts:[]};if(!a.immunity)a.immunity={};if(!a.routine)a.routine=routineFor(a);}
export function beginAction(w,a,action,rand,controlled=false){
 const l=a.life,net=decisionNetwork(w,a),home=a.home||{x:-10,z:-15};let target=cityDestination(a,action,rand),peer=null;
 if(['Rest','Family'].includes(action))target={x:home.x,z:home.z};
 if(action==='Socialize'||action==='Theft'){const candidates=w.citizens.filter(b=>b.id!==a.id&&b.health>0).sort((b,c)=>Math.hypot(a.x-b.x,a.z-b.z)-Math.hypot(a.x-c.x,a.z-c.z));peer=candidates[Math.floor(rand()*Math.min(8,candidates.length))];if(peer)target={x:peer.x,z:peer.z};}
 a.target=target;a.action=action;a.scores=net.outputs.map(n=>[n.name,n.value]);
 l.plan={action,started:w.minutes,remaining:action==='Rest'?routineFor(a).sleepHours*60:durations[action]||30,worked:0,x:net.x,reward:0,peer:peer?.id||null,controlled};
 const why={Eat:'I am hungry. I will get a meal.',Rest:'I will head home and recover.',Work:`I will finish a shift as ${a.role.toLowerCase()}.`,Socialize:peer?`I miss company. I will visit ${peer.name}.`:'I will look for someone to talk to.',Explore:'I want a change of scenery and a new experience.',Family:'I want to spend time with my family.',School:'I will stay for class and learn.',Play:'I need a break. Some time in the park will help.',Research:'I want to develop a skill and discover something useful.',Solitude:'I want some quiet time by myself.',Theft:'I am considering taking money from someone. It could cost me trust and freedom.',Travel:'I am heading to a different neighborhood.',Clinic:'I feel unwell. I will visit the community clinic.'};
 a.thought=(controlled?'My choice: ':'')+why[action];l.thoughts.unshift({time:w.minutes,text:a.thought});l.thoughts.length=Math.min(12,l.thoughts.length);
}
export function finishAction(w,a){const l=a.life,p=l.plan;if(!p)return;const reward=clamp(p.reward,-2,2);learn(a.brain,p.x,p.action,reward);l.recent[p.action]=w.minutes;l.history.unshift({time:w.minutes,text:`${p.action}: ${p.worked>0?'completed':'could not complete'} · feedback ${reward.toFixed(2)}`});l.history.length=Math.min(20,l.history.length);l.satisfaction=clamp(l.satisfaction+reward*.04);
 if(!p.controlled&&Math.abs(reward)>.1){l.adaptations??=[];const old=a.drives.caution;a.drives.caution=clamp(old+(reward<0?.008:-.002));if(p.action==='Socialize')a.routine.solitude=clamp(a.routine.solitude+(reward<0?.01:-.003));if(p.action==='Research'&&reward>0)a.routine.curiosity=clamp(a.routine.curiosity+.003);l.adaptations.unshift({time:w.minutes,text:`After ${p.action}: caution ${old.toFixed(3)} → ${a.drives.caution.toFixed(3)}; learned weights updated from ${reward.toFixed(2)} feedback.`});l.adaptations.length=Math.min(20,l.adaptations.length);}
if(p.action==='Research'||p.action==='Clinic'||p.action==='Family')rememberLife(w,a,l.history[0].text);l.plan=null;}
export function lifeTick(w,a,rand){
 ensureLife(a,rand);const l=a.life;
 l.loneliness=clamp(l.loneliness+.0006*(1-routineFor(a).solitude*.8));l.boredom=clamp(l.boredom+.0007);l.stress=clamp(l.stress+(a.wealth<10?.0003:-.0001));
 a.hunger=clamp(a.hunger+.00065);a.energy=clamp(a.energy-.00045);if(a.energy<.12)l.stress=clamp(l.stress+.001);
 const controlled=w.player?.id===a.id&&w.player.controlled;
 if(controlled&&w.player.move&&(w.player.move.x||w.player.move.z)){l.plan=null;a.action='Walk';const {x,z}=w.player.move,mag=Math.hypot(x,z);a.x=clamp(a.x+x/mag*4,CITY_BOUNDS.minX,CITY_BOUNDS.maxX);a.z=clamp(a.z+z/mag*4,CITY_BOUNDS.minZ,CITY_BOUNDS.maxZ);a.target={x:a.x+x/mag,z:a.z+z/mag};a.thought='I am walking where I choose.';return;}
 if(a.directive){beginAction(w,a,a.directive.action,rand,true);if(a.directive.target)a.target={...a.directive.target};if(a.directive.peer)l.plan.peer=a.directive.peer;if(a.directive.message)l.plan.message=a.directive.message;a.directive=null;}
 if(controlled&&w.player.command){beginAction(w,a,w.player.command,rand,true);w.player.command=null;}
 // Critical needs can interrupt NPC plans; manual characters retain their own choices.
 const urgent=a.hunger>.9?'Eat':a.energy<.08?'Rest':a.health<.4&&a.illness&&!a.illness.treated?'Clinic':null;
 if(!controlled&&!l.plan?.controlled&&a.autonomy!==false&&urgent&&l.plan?.action!==urgent){finishAction(w,a);beginAction(w,a,urgent,rand);}
 if(l.plan&&w.minutes-l.plan.started>720){l.plan.reward-=.4;finishAction(w,a);}
 if(!l.plan){if(controlled||a.autonomy===false){a.action='Idle';a.target={x:a.x,z:a.z};a.thought='What shall I do next?';return;}const net=decisionNetwork(w,a);const viable=net.outputs.filter(n=>n.value>0);const choices=viable.slice(0,3);const chosen=choices.map(n=>({...n,choice:n.value+rand()*.28})).sort((a,b)=>b.choice-a.choice)[0];beginAction(w,a,chosen?.name||'Explore',rand);}
 const p=l.plan;if(['Socialize','Theft'].includes(p.action)&&p.worked===0){const peer=w.citizens.find(b=>b.id===p.peer&&b.health>0);if(peer)a.target={x:peer.x,z:peer.z};}
 const dx=a.target.x-a.x,dz=a.target.z-a.z,d=Math.hypot(dx,dz);
 if(d>.4){const speed=Math.min(d,a.illness?2:(d>100?12:4));a.x+=dx/d*speed;a.z+=dz/d*speed;return;}
 p.worked++;p.remaining--;
 if(a.action==='Eat'){if(w.food>=1&&(a.wealth>=w.price||a.age<18||w.treasury>=w.price)){w.food-=1;const paid=Math.min(a.wealth,w.price);a.wealth-=paid;if(paid<w.price)w.treasury=Math.max(0,w.treasury-(w.price-paid));else w.treasury+=paid;a.hunger=clamp(a.hunger-.3*routineFor(a).mealSize);p.reward+=.5;if(a.hunger<.1)p.remaining=0;}else {p.reward-=.15;p.remaining=0;a.thought='Food is unavailable or too expensive. I need another plan.';}}
 if(a.action==='Rest'){a.energy=clamp(a.energy+.004);l.stress=clamp(l.stress-.002);if(!a.illness)a.health=clamp(a.health+.0002);p.reward+=.003;if(a.energy>.97&&!sleepTime(w,a))p.remaining=0;}
 if(a.action==='Work'){const wage=a.job?.wage??.25;a.wealth+=wage*(1-w.tax);w.treasury+=wage*w.tax;w.food+=.09;w.materials+=.025;l.boredom=clamp(l.boredom+.001);l.stress=clamp(l.stress+.0005);p.reward+=.004;}
 if(['Play','Explore'].includes(a.action)){l.boredom=clamp(l.boredom-.007);l.stress=clamp(l.stress-.002);p.reward+=.006;}
 if(a.action==='Solitude'){l.stress=clamp(l.stress-.008);l.boredom=clamp(l.boredom-.002);p.reward+=.006;}
 if(a.action==='Theft'&&p.worked===1){const b=w.citizens.find(b=>b.id===p.peer);if(b&&Math.hypot(a.x-b.x,a.z-b.z)<5){const outcome=attemptTheft(w,a,b,rand);p.reward+=outcome.reward;a.thought=outcome.text;}else p.reward-=.2;p.remaining=0;}
 if(['Research','School'].includes(a.action)){a.skills??={research:0};a.skills.research=Math.min(100,(a.skills.research||0)+.015);a.routine.knowledge=a.skills.research;l.boredom=clamp(l.boredom-.004);p.reward+=.005;}
 if(['Socialize','Family'].includes(a.action)){const ids=a.action==='Family'?[a.partner,...a.children,...a.parents]:[p.peer];const contacts=w.citizens.filter(b=>b.health>0&&ids.includes(b.id)&&Math.hypot(a.x-b.x,a.z-b.z)<4);if(contacts.length){l.loneliness=clamp(l.loneliness-.012);for(const b of contacts){if(p.worked===1)talk(w,a,b,p.message||null);a.relations[b.id]=clamp((a.relations[b.id]||0)+.003,-1,1);b.relations[a.id]=clamp((b.relations[a.id]||0)+.003,-1,1);if(b.life)b.life.loneliness=clamp(b.life.loneliness-.005);}p.reward+=.01;}else{p.reward-=.002;if(p.worked>20){p.remaining=0;a.thought='They are not here. I will try again later.';}}}
 if(a.action==='Clinic'){if(a.illness){a.illness.treated=true;a.health=clamp(a.health+.002);p.reward+=.012;}else{a.health=clamp(a.health+.001);p.reward+=.002;}l.stress=clamp(l.stress-.004);}
 if(p.remaining<=0)finishAction(w,a);
}
// Fictional game illnesses. Durations/probabilities are balance parameters, not medical estimates.
export const DISEASES={bay_fever:{name:'Bay fever',incubation:720,duration:5760,damage:.00007},stomach_bug:{name:'Stomach bug',incubation:240,duration:2880,damage:.00005}};
export function infect(w,a,kind,rand){if(a.illness||a.health<=0||(a.immunity?.[kind]||0)>w.minutes)return false;const d=DISEASES[kind];if(!d)return false;a.illness={kind,since:w.minutes,ends:w.minutes+d.duration+Math.floor(rand()*720),treated:false};rememberLife(w,a,`Contracted ${d.name}.`);note(w,`${a.name} has contracted ${d.name}.`);return true;}
export function healthTick(w,alive,rand){
 for(const a of alive){if(!a.illness)continue;const ill=a.illness,d=DISEASES[ill.kind];if(w.minutes>=ill.ends){a.immunity??={};a.immunity[ill.kind]=w.minutes+20160;a.illness=null;rememberLife(w,a,`Recovered from ${d.name}; temporary immunity.`);note(w,`${a.name} recovered from ${d.name}.`);continue;}
 if(w.minutes-ill.since>=d.incubation){a.health=clamp(a.health-d.damage*(ill.treated?.25:1)*(a.action==='Rest'?.65:1));a.energy=clamp(a.energy-.0002);if(ill.kind==='stomach_bug')a.hunger=clamp(a.hunger+.0003);if(ill.treated)ill.ends-=.5;}
 }
 if(w.ticks%60!==0)return;
 const infectious=alive.filter(a=>a.illness&&w.minutes-a.illness.since>=DISEASES[a.illness.kind].incubation);
 for(const a of infectious)for(const b of alive){if(a===b||b.illness)continue;const distance=Math.hypot(a.x-b.x,a.z-b.z);if(distance<2.5&&rand()<(a.illness.treated?.015:.07))infect(w,b,a.illness.kind,rand);}
 if(w.ticks%1440===0&&alive.length&&rand()<.35)infect(w,alive[Math.floor(rand()*alive.length)],rand()<.7?'bay_fever':'stomach_bug',rand);
}
