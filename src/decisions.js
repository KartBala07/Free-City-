const clamp=x=>Math.max(0,Math.min(1.5,x));
// These very same weighted sums drive actions and the inspection graph.
export function decisionNetwork(world,a){
 const hour=Math.floor(world.minutes%1440/60),school=a.age>=5&&a.age<18&&hour>=8&&hour<16;
 const inputs=[['hunger','Hunger',a.hunger],['fatigue','Fatigue',1-a.energy],['lowMoney','Low funds',a.wealth<15?1:0],['healthRisk','Health risk',1-a.health],['ambition','Ambition',a.drives.ambition],['empathy','Empathy',a.drives.empathy],['analysis','Curiosity',a.drives.analysis],['caution','Caution',a.drives.caution],['aggression','Aggression',a.drives.aggression],['child','Under 18',a.age<18?1:0],['school','School time',school?1:0],['family','Family time',a.partner||a.parents.length||a.children.length?(hour>=18&&hour<21?1:.12):0],['night','Night',hour<7||hour>=22?1:0]];
 const definitions=[['food','Nourish',0,{hunger:1.4}],['rest','Recover',0,{fatigue:1.2,healthRisk:.3,night:.25}],['work','Provide',.25,{ambition:.35,lowMoney:.3,child:-1}],['social','Connect',.06,{empathy:.65,aggression:-.15}],['explore','Discover',.12,{analysis:.45,caution:-.08}],['family','Care',0,{family:.8,empathy:.15}],['learn','Learn',0,{school:1.1}]];
 const values=Object.fromEntries(inputs.map(([id,,value])=>[id,value])),hidden=definitions.map(([id,label,bias,weights])=>({id,label,bias,weights,value:clamp(bias+Object.entries(weights).reduce((sum,[key,w])=>sum+values[key]*w,0))}));
 const outputs=[['Eat','food'],['Rest','rest'],['Work','work'],['Socialize','social'],['Explore','explore'],['Family','family'],['School','learn']].map(([name,key])=>({name,key,value:hidden.find(n=>n.id===key).value}));
 outputs.sort((a,b)=>b.value-a.value);return {inputs:inputs.map(([id,label,value])=>({id,label,value})),hidden,outputs};
}
