type SPL={id:string;set_id?:string;effective_time?:string;openfda?:{brand_name?:string[];generic_name?:string[];manufacturer_name?:string[];route?:string[];substance_name?:string[]};[key:string]:unknown};
const memo=new Map<string,{time:number;value:unknown}>();
export async function GET(request:Request){
 const name=(new URL(request.url).searchParams.get('name')||'').replace(/[^\p{L}\p{N}\s\-]/gu,' ').trim().slice(0,100);
 if(name.length<2)return Response.json({error:'A compound name is required.'},{status:400});
 const key=name.toLowerCase(),cached=memo.get(key);if(cached&&Date.now()-cached.time<3600000)return Response.json(cached.value);
 try{
  const url=new URL('https://api.fda.gov/drug/label.json');url.search=new URLSearchParams({search:`openfda.generic_name:"${name}" OR openfda.brand_name:"${name}"`,sort:'effective_time:desc',limit:'3'}).toString();
  const r=await fetch(url,{signal:AbortSignal.timeout(18000)});
  if(r.status===404)return Response.json({records:[],retrievedAt:new Date().toISOString(),note:'No matching label found. This is not proof of safety, approval, or the absence of a label under another name.'});
  if(!r.ok)throw new Error('upstream');
  const data=await r.json() as {meta?:{last_updated?:string};results?:SPL[]};
  const fields=[['boxed_warning','Boxed warning'],['warnings_and_cautions','Warnings and precautions'],['warnings','Warnings'],['contraindications','Contraindications'],['adverse_reactions','Adverse reactions'],['drug_interactions','Drug interactions'],['pregnancy','Pregnancy'],['nursing_mothers','Lactation'],['use_in_specific_populations','Specific populations'],['abuse','Abuse'],['dependence','Dependence'],['mechanism_of_action','Mechanism of action'],['pharmacokinetics','Pharmacokinetics']];
  const records=(data.results||[]).map(d=>({id:d.id,product:d.openfda?.brand_name?.join(' / ')||d.openfda?.generic_name?.join(' / ')||name,generic:d.openfda?.generic_name?.join(' / '),ingredients:d.openfda?.substance_name?.join(', '),manufacturer:d.openfda?.manufacturer_name?.join(' / '),route:d.openfda?.route?.join(', '),effectiveDate:d.effective_time,url:d.set_id?`https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(d.set_id)}`:`https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(name)}`,sections:fields.flatMap(([field,title])=>{const text=Array.isArray(d[field])?(d[field] as string[]).join('\n\n').replace(/<[^>]*>/g,' '):'';return text?[{title,text:text.slice(0,45000),truncated:text.length>45000}]:[]})}));
  const value={records,retrievedAt:new Date().toISOString(),datasetUpdated:data.meta?.last_updated};if(memo.size>20)memo.clear();memo.set(key,{time:Date.now(),value});return Response.json(value);
 }catch{return Response.json({error:'Live label data is temporarily unavailable. Consult the linked source labels and curated safety summary.'},{status:502})}
}
