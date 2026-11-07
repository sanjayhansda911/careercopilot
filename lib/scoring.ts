export type JobInput = { title:string; description:string; location?:string|null; work_mode?:string|null; salary_min_lpa?:number|null; salary_max_lpa?:number|null; notice_days_required?:number|null };
export type ProfileInput = { total_experience_years:number; target_ctc_min_lpa:number; target_ctc_max_lpa:number; notice_period_days:number; preferred_locations:string[]; preferred_work_modes:string[]; target_roles:string[]; target_domains:string[]; skills:string[] };
export type ScoreResult = { total:number; breakdown:Record<string,number>; recommendation:'apply_now'|'review'|'stretch'|'ignore'; strengths:string[]; gaps:string[] };
const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9+#. ]/g,' ').replace(/\s+/g,' ').trim();
function phraseMatches(phrases:string[],text:string){const t=normalize(text);return [...new Set(phrases)].filter(p=>p.trim().length>2 && t.includes(normalize(p)));}
export function scoreJob(job:JobInput,p:ProfileInput):ScoreResult{
 const text=`${job.title} ${job.description}`;
 const skillHits=phraseMatches(p.skills,text);
 const roleHits=phraseMatches(p.target_roles,job.title);
 const domainHits=phraseMatches(p.target_domains,text);
 const skillScore=Math.min(25,Math.round((skillHits.length/Math.max(1,Math.min(p.skills.length,8)))*25));
 const roleSeniority=/senior|lead|principal|group|director|head/i.test(job.title)?20:/product manager|product owner/i.test(job.title)?17:12;
 const domainScore=Math.min(15,Math.round((domainHits.length/Math.max(1,Math.min(p.target_domains.length,3)))*15));
 const maxSalary=job.salary_max_lpa;
 const compensation=maxSalary==null?7:maxSalary>=p.target_ctc_min_lpa?15:maxSalary>=p.target_ctc_min_lpa*.85?9:3;
 const leadership=/lead|manager|head|stakeholder|roadmap|strategy|cross.functional|team/i.test(job.description)?10:5;
 const location=(p.preferred_locations.some(x=>normalize(job.location??'').includes(normalize(x)))||/remote/i.test(job.work_mode??''))?10:4;
 const notice=job.notice_days_required==null?4:job.notice_days_required>=p.notice_period_days?5:1;
 const breakdown={experience_skills:skillScore,role_seniority:roleSeniority,domain_relevance:domainScore,compensation,leadership_scope:leadership,location_work_mode:location,notice_period:notice};
 const total=Math.min(100,Object.values(breakdown).reduce((a,b)=>a+b,0));
 const recommendation=total>=80?'apply_now':total>=65?'review':total>=50?'stretch':'ignore';
 const gaps=p.skills.filter(s=>!normalize(text).includes(normalize(s))).slice(0,10);
 return {total,breakdown,recommendation,strengths:[...roleHits,...skillHits,...domainHits].slice(0,15),gaps};
}
