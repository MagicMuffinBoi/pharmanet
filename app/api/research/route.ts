import { categoryQueries, compounds } from '@/lib/directory';
type Paper = {id:string; source:string; title:string; authorString?:string; pubYear?:string; firstPublicationDate?:string; journalInfo?:{journal?:{title?:string}}; pubTypeList?:{pubType?:string[]}; isOpenAccess?:string; doi?:string; abstractText?:string; isRetracted?:string};
const cache = new Map<string,{time:number;body:unknown}>();
export async function GET(request: Request) {
 const url = new URL(request.url);
 const category = url.searchParams.get('category') || 'All';
 const compound = compounds.find(c=>c.id===url.searchParams.get('compound'));
 const q = (url.searchParams.get('q')||'').slice(0,160).replace(/[^\p{L}\p{N}\s\-]/gu,' ').trim();
 const year = url.searchParams.get('recent')==='1' ? new Date().getUTCFullYear()-1 : 1900;
 const type = url.searchParams.get('type');
 const typeClause = type==='trial' ? ' AND PUB_TYPE:"randomized controlled trial"' : type==='review' ? ' AND (PUB_TYPE:"systematic review" OR PUB_TYPE:"meta-analysis")' : '';
 const terms = compound?.query || categoryQueries[category] || categoryQueries.All;
 const keywords=q.split(/\s+/).filter(Boolean).map(w=>'"'+w+'"').join(' AND ');
 const scope=q&&category==='All'&&!compound?`TITLE_ABS:(${keywords})`:`TITLE_ABS:(${terms})${q?` AND TITLE_ABS:(${keywords})`:''}`;
 const query = `${scope} AND SRC:MED AND NOT RETRACTED:Y AND FIRST_PDATE:[${year}-01-01 TO ${new Date().toISOString().slice(0,10)}]${typeClause}`;
 const cursor=(url.searchParams.get('cursor')||'*').slice(0,500);
 const key=JSON.stringify([query,cursor]);
 const cached=cache.get(key);
 if(cached && Date.now()-cached.time<600000) return Response.json(cached.body);
 try {
  const upstream=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  upstream.search=new URLSearchParams({query,format:'json',resultType:'core',pageSize:'12',cursorMark:cursor,sort:'FIRST_PDATE_D desc'}).toString();
  const response=await fetch(upstream.toString(),{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});
  if(!response.ok) throw new Error('upstream');
  const data=await response.json() as {hitCount:number;nextCursorMark?:string;resultList?:{result?:Paper[]}};
  const items=(data.resultList?.result||[]).filter(p=>p.isRetracted!=='Y').map(p=>{
   const types=p.pubTypeList?.pubType||[];
   const plain=(p.abstractText||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
   return {id:p.id,title:p.title,authors:p.authorString||'Author information unavailable',year:p.pubYear,date:p.firstPublicationDate,journal:p.journalInfo?.journal?.title||'PubMed-indexed publication',type:types.some(t=>/meta-analysis|systematic review/i.test(t))?'Evidence review':types.some(t=>/randomized controlled trial/i.test(t))?'Randomized trial':types.some(t=>/review/i.test(t))?'Review':types.some(t=>/case report/i.test(t))?'Case report':'Journal article',openAccess:p.isOpenAccess==='Y',snippet:plain?plain.split(' ').slice(0,44).join(' ')+'…':'No abstract excerpt available. Read the indexed record for study details.',url:`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(p.id)}/`,doi:p.doi?`https://doi.org/${encodeURIComponent(p.doi)}`:null};
  });
  const body={items,total:data.hitCount,nextCursor:items.length===12&&data.nextCursorMark!==cursor?data.nextCursorMark:null,retrievedAt:new Date().toISOString(),provider:'Europe PMC · PubMed-indexed records',query};
  if(cache.size>100)cache.clear();
  cache.set(key,{time:Date.now(),body});
  return Response.json(body,{headers:{'Cache-Control':'private, max-age=60'}});
 } catch {
  return Response.json({error:'The literature index is temporarily unavailable. Your curated directory remains available. Please retry shortly.'},{status:502});
 }
}
