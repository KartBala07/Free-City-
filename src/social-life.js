import {districtAt,routineFor} from './city-life.js';
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
function record(w,a,text){a.memories.unshift({time:w.minutes,text});a.memories.length=Math.min(a.memories.length,40);}
function event(w,text){w.events.unshift({time:w.minutes,text});w.events.length=Math.min(w.events.length,100);}
export function talk(w,a,b,message=null){if(!a||!b||a.id===b.id||a.health<=0||b.health<=0)return false;
 const content=(message||'').toLowerCase();const topic=/sick|ill|health|clinic/.test(content)?'health':/job|work|money/.test(content)?'work':/study|learn|school|knowledge/.test(content)?'learning':/alone|sad|stress|worry/.test(content)?'stress':a.illness?'health':a.wealth<30?'work':(a.skills?.research||0)>60?'learning':a.life?.stress>.6?'stress':'community';
 const opening=message||({health:'I have been feeling unwell. Could you check on me?',work:`I am trying to earn enough through my ${a.role.toLowerCase()} work.`,learning:'I learned something interesting today. Want to study together?',stress:'It has been a difficult day. I could use some company.',community:`Would you like to help make ${districtAt(a).name} a better place?`}[topic]);
 const receptive=(a.relations[b.id]||0)>-.4&&routineFor(b).solitude<.85;
 const reply=!receptive?'I need some space right now. Let us talk another time.':topic==='health'?'Please rest. I can visit and keep you company.':topic==='work'?'Let us share what we know about work and help each other.':topic==='learning'?'Yes. I would like to exchange ideas and learn together.':'I would like that. It is good to have someone to talk with.';
 w.conversations??=[];w.conversations.unshift({time:w.minutes,from:a.id,to:b.id,text:opening,reply,topic});w.conversations.length=Math.min(80,w.conversations.length);
 if(receptive){for(const p of [a,b]){if(p.routine)p.routine.socialSkill=clamp(p.routine.socialSkill+.02,0,100);if(p.skills)p.skills.communication=clamp((p.skills.communication||0)+.02,0,100);if(topic==='learning'&&p.skills)p.skills.research=clamp((p.skills.research||0)+.05,0,100);}}
 const delta=receptive?.025+routineFor(a).socialSkill/2000:-.01;
 a.relations[b.id]=clamp((a.relations[b.id]||0)+delta,-1,1);b.relations[a.id]=clamp((b.relations[a.id]||0)+delta,-1,1);
 if(a.life)a.life.loneliness=clamp(a.life.loneliness-(receptive?.15:.01));if(b.life)b.life.loneliness=clamp(b.life.loneliness-(receptive?.12:0));
 record(w,a,`${b.name}: “${reply}”`);record(w,b,`${a.name}: “${opening}”`);
 if(receptive&&a.relations[b.id]>.25){a.friends??=[];b.friends??=[];if(!a.friends.includes(b.id))a.friends.push(b.id);if(!b.friends.includes(a.id))b.friends.push(a.id);}
 if(receptive&&a.relations[b.id]>.35&&a.drives.empathy>.45&&b.drives.empathy>.45){w.communities??=[];let club=w.communities.find(c=>c.members.includes(a.id)||c.members.includes(b.id));if(!club&&w.communities.length<24){club={id:w.communities.length+1,name:`${districtAt(a).name} ${topic==='learning'?'Study Circle':'Neighbors'}`,purpose:topic==='learning'?'Share knowledge':'Mutual help',members:[],created:w.minutes};w.communities.push(club);event(w,`${a.name} and ${b.name} started ${club.name}.`);}if(club)for(const id of [a.id,b.id])if(!club.members.includes(id))club.members.push(id);}
 return receptive;
}
export function attemptTheft(w,a,b,rand){if(!b||b.health<=0||b.wealth<1||a.age<18)return {reward:-.2,text:'No theft occurred.'};const caught=rand()<.35+(b.drives.caution||0)*.25,amount=Math.min(b.wealth,5+Math.floor(rand()*20));a.life.reputation??=0;
 if(caught){const fine=Math.min(a.wealth,30);a.wealth-=fine;w.treasury+=fine;a.life.reputation=clamp(a.life.reputation-.15,-1,1);a.life.stress=clamp(a.life.stress+.2);a.drives.caution=clamp(a.drives.caution+.04);record(w,a,`Caught attempting theft from ${b.name}; paid ${fine.toFixed(0)} credits in restitution/fine.`);}
 else{b.wealth-=amount;a.wealth+=amount;a.life.reputation=clamp(a.life.reputation-.08,-1,1);record(w,a,`Stole ${amount} credits from ${b.name}; trust was damaged.`);}
 a.relations[b.id]=clamp((a.relations[b.id]||0)-.35,-1,1);b.relations[a.id]=clamp((b.relations[a.id]||0)-.55,-1,1);if(b.life)b.life.stress=clamp(b.life.stress+.25);record(w,b,`${a.name} attempted to steal from me.`);event(w,`${a.name} ${caught?'was caught attempting theft from':'stole from'} ${b.name}.`);return {reward:caught?-.8:.05,text:caught?'I was caught. That choice cost me money and trust.':'I gained money, but damaged trust and my reputation.'};}

export function communityDay(w){for(const c of w.communities||[]){const people=w.citizens.filter(a=>a.health>0&&c.members.includes(a.id)),poor=people.filter(a=>a.wealth<25),donor=people.find(a=>a.wealth>100&&a.drives.empathy>.6);if(donor&&poor.length){const grant=Math.min(5,donor.wealth*.02);donor.wealth-=grant;for(const a of poor)a.wealth+=grant/poor.length;event(w,`${c.name} shared ${grant.toFixed(0)} credits with neighbors.`);}}}
