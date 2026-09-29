import {DISTRICTS} from "./city-life.js";
// A deterministic virtual census, not fifty million per-frame agents.
export const POPULATION = 50_000_000;
export const ACTIVE_LIMIT = 400;
export const INITIAL_ACTIVE = 240;
export const FIRST = 'Olivia Liam Emma Noah Amelia Oliver Sophia Mateo Charlotte Elijah Isabella Lucas Mia Ethan Evelyn Arjun Harper Aiden Sofia Leo Camila Daniel Luna James Maya Benjamin Ella Henry Aisha Gabriel Zoe Sebastian Nora Jack Leila Julian Grace Owen Layla Theo Elena Kai Mila Adrian Chloe Luca Priya Isaac Hannah David Sara Ezra Yara Felix Naomi Samuel Ava Asher Lucia Oscar Amara Adam Imani Rafael Iris Yusuf Anika Diego'.split(' ');
const LAST = 'Chen Garcia Patel Nguyen Johnson Kim Williams Brown Singh Lee Wilson Martinez Rodriguez Hernandez Davis Lopez Gonzalez Anderson Thomas Taylor Moore Jackson Martin Ahmed Robinson Clark Lewis Walker Hall Allen Young King Wright Scott Torres Flores Rivera Campbell Mitchell Carter Roberts Gomez Phillips Evans Turner Diaz Parker Cruz Edwards Collins Reyes Stewart Morris Morales Murphy Cook Rogers Gutierrez Ortiz Morgan Cooper Peterson Bailey Reed Kelly Howard Ramos'.split(' ');
export const JOBS = [
 ['Software engineer','Technology','Bay Systems',.48],['Nurse','Healthcare','Harbor Medical',.42],['Teacher','Education','City Learning',.29],['Architect','Construction','Civic Studio',.40],['Electrician','Construction','Grid Works',.35],['Chef','Hospitality','Market Kitchen',.27],['Bus driver','Transport','City Transit',.31],['Research scientist','Research','Bay Laboratory',.45],['Store manager','Retail','Neighborhood Market',.30],['Social worker','Care','Community Services',.28],['Mechanic','Transport','Harbor Garage',.32],['Librarian','Education','City Library',.26],['Accountant','Finance','Pacific Accounts',.39],['Artist','Arts','Sunset Studio',.25],['Park ranger','Environment','City Parks',.28],['Carpenter','Construction','Civic Workshop',.32],['Pharmacist','Healthcare','Bay Pharmacy',.43],['Journalist','Media','City Chronicle',.31],['Office administrator','Services','Civic Offices',.28],['Delivery courier','Transport','Neighborhood Delivery',.25],['Dentist','Healthcare','Harbor Dental',.49],['Civil engineer','Construction','City Infrastructure',.43],['Childcare educator','Care','Little Horizons',.26],['Musician','Arts','Bay Ensemble',.24]
].map(([title,sector,employer,wage])=>({title,sector,employer,wage}));
export function hash(id,salt=0){let x=(id^Math.imul(salt+1,0x9e3779b1))>>>0;x=Math.imul(x^(x>>>16),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);return (x^(x>>>16))>>>0;}
export function unit(id,salt=0){return hash(id,salt)/4294967296;}
const choose=(arr,id,salt)=>arr[hash(id,salt)%arr.length];
export function residentName(id,seed=1){const household=Math.floor((id-1)/4);return `${choose(FIRST,id,seed)} ${String.fromCharCode(65+hash(id,seed+4)%26)}. ${choose(LAST,household+1,seed+7)}`;}
export function homeFor(id,seed=1){
 const household=Math.floor((id-1)/4),building=Math.floor(household/500)+1,within=household%500,floor=Math.floor(within/20)+1,door=within%20+1;
 const district=DISTRICTS[(building-1)%DISTRICTS.length],x=district.x+(unit(building,seed+30)-.5)*20,z=district.z+(unit(building,seed+31)-.5)*20;
 return {household:household+1,building,floor,unit:door,rooms:2+hash(household,seed)%3,x,z,label:`Bay Residence ${building.toLocaleString('en-US')} · Floor ${floor} · Apt ${String(door).padStart(2,'0')}`};
}
export function householdIds(id){const first=Math.floor((id-1)/4)*4+1;return [first,first+1,first+2,first+3];}
export function apartmentIds(building,floor,door){if(!Number.isInteger(building)||building<1||building>25000||!Number.isInteger(floor)||floor<1||floor>25||!Number.isInteger(door)||door<1||door>20)return [];const start=((building-1)*500+(floor-1)*20+door-1)*4+1;return householdIds(start);}
export function profile(id,seed=1){
 if(!Number.isInteger(id)||id<1||id>POPULATION)throw new Error('Resident ID must be between 1 and 50,000,000.');
 const family=householdIds(id),slot=(id-1)%4,household=Math.floor((id-1)/4),adultAge=36+hash(household,seed+19)%22;
 const age=slot<2?adultAge+(slot===1?2:0):5+hash(id,seed+20)%13;
 const home=homeFor(id,seed),job=slot<2?choose(JOBS,id,seed+9):{title:'Student',sector:'Education',employer:'City School',wage:0};
 const drives={empathy:.25+unit(id,seed+1)*.65,ambition:.25+unit(id,seed+2)*.65,caution:.2+unit(id,seed+3)*.7,aggression:.05+unit(id,seed+4)*.5,analysis:.2+unit(id,seed+5)*.7};
 const skills=Object.fromEntries(['communication','building','research','care','creativity','organization'].map((k,i)=>[k,Math.round(12+unit(id,seed+60+i)*(slot<2?75:35))]));
 const friends=[((household+1)%12500000)*4+slot+1,((household+12499999)%12500000)*4+slot+1];
 return {id,name:residentName(id,seed),age,home,job,role:job.title,drives,skills,parents:slot<2?[]:family.slice(0,2),children:slot<2?family.slice(2):[],partner:slot===0?family[1]:slot===1?family[0]:null,friends,gender:choose(['F','M','NB'],id,seed+81),generation:slot<2?1:2,faction:hash(household,seed+23)%3,goal:slot<2?['Provide for my family','Become skilled at my work','Help my community'][hash(id,seed+24)%3]:'Learn, make friends, and grow',skin:choose(['#f2c5a1','#c58d63','#825334','#563827'],id,seed+25),clothes:choose(['#55c7a5','#db9b57','#9292d9','#68a7d3','#d37e89','#d4c375'],id,seed+26)};
}
export function makeActive(id,seed,minutes=480){
 const p=profile(id,seed);return {...p,x:p.home.x+(unit(id,11)-.5)*2,z:p.home.z+(unit(id,12)-.5)*2,health:1,energy:.8,hunger:.15,wealth:p.age<18?15:45+unit(id,seed+29)*90,action:'Explore',thought:'A new day in my neighborhood.',scores:[],memories:[{time:minutes,text:`Household record: ${p.home.label}.`}],relations:Object.fromEntries([...p.friends,...p.parents,...p.children,...(p.partner?[p.partner]:[])].map(r=>[r,r===p.partner?.9:p.friends.includes(r)?.6:.85])),lastBirth:minutes,target:{x:p.home.x,z:p.home.z}};
}
export function seedPopulation(world,replace=false){
 if(world.population)return world;
 world.population={total:POPULATION,seed:world.rng>>>0,modelVersion:1};
 if(replace){world.citizens=Array.from({length:INITIAL_ACTIVE},(_,i)=>makeActive(Math.floor(i/4)*2000+i%4+1,world.population.seed,world.minutes));world.food=INITIAL_ACTIVE*6;world.materials=400;world.events=[{time:world.minutes,text:'A virtual city of 50 million residents begins. 240 residents are active.'}];}
 else for(const a of world.citizens){if(a.id<=POPULATION){const p=profile(a.id,world.population.seed);a.archetype=a.name;a.name=p.name;for(const key of ['home','job','skills','gender','generation','skin','clothes'])a[key]=p[key];a.role=a.age<18?'Student':p.job.title;}}
 world.nextId=Math.max(POPULATION+1,world.nextId,...world.citizens.map(a=>a.id+1));return world;
}
export function resident(world,id){const live=world.citizens.find(a=>a.id===id);if(live)return {person:live,active:true};const p=makeActive(id,world.population?.seed||1,world.minutes);const hour=Math.floor(world.minutes%1440/60);p.age+=(world.minutes-480)/518400;p.action=hour<7||hour>=22?'Rest':hour>=9&&hour<16?(p.age<18?'School':'Work'):hour>=18?'Family':'Explore';p.thought=p.action==='Rest'?`I am resting at home with my household.`:p.action==='Work'?`My shift at ${p.job.employer} is part of today's schedule.`:p.action==='School'?'It is time for school and learning.':'I have time for family and my neighborhood.';p.memories=[];return {person:p,active:false};}
export function activateHousehold(world,id){const missing=householdIds(id).filter(id=>!world.citizens.some(a=>a.id===id));if(world.citizens.length+missing.length>ACTIVE_LIMIT)throw new Error(`The active simulation is limited to ${ACTIVE_LIMIT} residents. You can still inspect every virtual household.`);for(const n of missing)world.citizens.push(makeActive(n,world.population.seed,world.minutes));world.food+=missing.length*6;return missing.length;}
