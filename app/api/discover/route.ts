const memo = new Map<string,{time:number;value:unknown}>();
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 const q=(p.get('q')||'').trim().slice(0,120);
 const resolve=p.get('resolve')==='1';
 if(q.length<2||/[\x00-\x1f]/.test(q))return Response.json({error:'Enter a compound name with at least two characters.'},{status:400});
 const key=JSON.stringify([q.toLowerCase(),resolve]);const cached=memo.get(key);if(cached&&Date.now()-cached.time<3600000)return Response.json(cached.value);
 try{
  let value:unknown;
  if(!resolve){
   const r=await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(q)}/json?limit=12`,{signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('upstream');
   const d=await r.json() as {total?:number;dictionary_terms?:{compound?:string[]}};
   value={names:d.dictionary_terms?.compound||[],total:d.total||0,retrievedAt:new Date().toISOString()};
  }else{
   const r=await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/property/Title,MolecularFormula,MolecularWeight/JSON`,{signal:AbortSignal.timeout(18000)});
   if(r.status===404)return Response.json({error:'No exact PubChem identity was found for this name. Try an alternative name or search the literature.'},{status:404});
   if(!r.ok)throw new Error('upstream');
   const d=await r.json() as {PropertyTable?:{Properties?:{CID:number;Title:string;MolecularFormula?:string;MolecularWeight?:string}[]}};
   const item=d.PropertyTable?.Properties?.[0];if(!item)throw new Error('record');
   value={cid:item.CID,name:item.Title,formula:item.MolecularFormula,weight:item.MolecularWeight,url:`https://pubchem.ncbi.nlm.nih.gov/compound/${item.CID}`,retrievedAt:new Date().toISOString(),matchedName:q};
  }
  if(memo.size>150)memo.clear();memo.set(key,{time:Date.now(),value});return Response.json(value);
 }catch{return Response.json({error:'PubChem lookup is temporarily unavailable. The curated catalog and literature search are still available.'},{status:502})}
}
