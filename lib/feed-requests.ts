// One request at a time, two seconds apart. Never retry a rate/service limit in the same run.
export async function serialFeeds<Q,T>(queries:Q[],read:(query:Q)=>Promise<T>,pause:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 const results:PromiseSettledResult<T>[]=[];
 for(let i=0;i<queries.length;i++){
  if(i)await pause(2000);
  try{results.push({status:'fulfilled',value:await read(queries[i])})}
  catch(reason){results.push({status:'rejected',reason});const status=(reason as {status?:number})?.status;
   if(status===429||status===503){for(let j=i+1;j<queries.length;j++)results.push({status:'rejected',reason:new Error('제한 응답으로 추가 요청 중단')});break}
  }
 }
 return results;
}
