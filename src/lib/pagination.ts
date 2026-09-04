export const pageSize=10;
export type SearchValues=Record<string,string|string[]|undefined>;
export function pageRequest(value:unknown){
 const parsed=typeof value==='string'&&/^[1-9]\d*$/.test(value)?Number(value):1;
 const page=Number.isSafeInteger(parsed)?Math.min(parsed,10000):1;
 return {page,from:(page-1)*pageSize,to:page*pageSize-1};
}
export function pageCount(total:number){return Math.max(1,Math.ceil(total/pageSize));}
export function pageHref(path:string,page:number,filters:Record<string,string>={}){
 return `${path}?${new URLSearchParams({...filters,page:String(page)})}`;
}
