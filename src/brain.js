// Adapted from the uploaded GENESIS sim.js Brain.forward/learn implementation.
// Plain arrays and injected seeded randomness keep learning saveable/reproducible.
export const INPUTS=16,HIDDEN=8,ACTIONS=['Eat','Rest','Work','Socialize','Explore','Family','School','Play','Research','Clinic'];
const clamp=(n)=>Math.round(Math.max(-3,Math.min(3,n))*1e6)/1e6;
export function newBrain(rand){return {version:1,w1:Array.from({length:INPUTS*HIDDEN},()=> clamp((rand()-.5)*.8)),b1:Array(HIDDEN).fill(0),w2:Array.from({length:HIDDEN*ACTIONS.length},()=> clamp((rand()-.5)*.08)),b2:Array(ACTIONS.length).fill(0),lessons:0};}
export function forward(brain,x){const h=brain.b1.map((b,j)=>Math.tanh(b+x.reduce((s,v,i)=>s+brain.w1[i*HIDDEN+j]*v,0)));const o=brain.b2.map((b,k)=>1.6*Math.tanh((b+h.reduce((s,v,j)=>s+brain.w2[j*ACTIONS.length+k]*v,0))*.5));return {h,o};}
export function learn(brain,x,action,reward){const k=ACTIONS.indexOf(action);if(k<0||Math.abs(reward)<.02)return;const {h}=forward(brain,x),lr=.035*Math.max(-2,Math.min(2,reward));for(let j=0;j<HIDDEN;j++){for(let i=0;i<INPUTS;i++)brain.w1[i*HIDDEN+j]=clamp(brain.w1[i*HIDDEN+j]+lr*h[j]*.5*x[i]);brain.b1[j]=clamp(brain.b1[j]+lr*h[j]*.03);}for(let k2=0;k2<ACTIONS.length;k2++){const scale=lr*.45*(k2===k?1:-1/(ACTIONS.length-1));for(let j=0;j<HIDDEN;j++)brain.w2[j*ACTIONS.length+k2]=clamp(brain.w2[j*ACTIONS.length+k2]+scale*h[j]);brain.b2[k2]=clamp(brain.b2[k2]+scale*.12);}brain.lessons++;}

export function inheritBrain(parents,rand){const valid=parents.filter(Boolean);if(!valid.length)return newBrain(rand);const brain=newBrain(rand);for(const key of ['w1','b1','w2','b2'])brain[key]=brain[key].map((_,i)=>clamp(valid[Math.floor(rand()*valid.length)][key][i]+(rand()<.06?(rand()-.5)*.4:0)));return brain;}
