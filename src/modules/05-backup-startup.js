async function fromB64(s){
 const bin=atob(s),u=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++){
  u[i]=bin.charCodeAt(i);
  if((i&0x7ffff)===0x7ffff)await tick();
 }
 return u;
}
function tick(){return new Promise(r=>setTimeout(r,0))}
// Stream the backup JSON directly into small Blob parts. This keeps only a
// ~1 MB text buffer plus the current media Blob in JavaScript memory instead of
// materialising the whole (often 300 MB+) Base64 JSON as strings.
function createJsonSink(){
 const parts=[];let buf='';
 const flush=()=>{if(buf){parts.push(new Blob([buf]));buf=''}};
 return {write(s){if(!s)return;buf+=s;if(buf.length>=0x100000)flush()},parts(){flush();return parts}};
}
async function writeBase64(u8,sink,onBytes,state){
 const BLOCK=3*0x8000;
 for(let i=0;i<u8.length;i+=BLOCK){
  const block=u8.subarray(i,Math.min(i+BLOCK,u8.length));
  let bin='';
  for(let j=0;j<block.length;j+=0x8000)bin+=String.fromCharCode(...block.subarray(j,Math.min(j+0x8000,block.length)));
  sink.write(btoa(bin));
  if(onBytes)onBytes(block.length);
  if(Date.now()-state.lastYield>60){await tick();state.lastYield=Date.now()}
 }
}
async function writeBlobBase64(blob,sink,onBytes,state){
 const BLOCK=3*0x8000;
 for(let i=0;i<blob.size;i+=BLOCK){
  const block=new Uint8Array(await blob.slice(i,Math.min(i+BLOCK,blob.size)).arrayBuffer());
  let bin='';
  for(let j=0;j<block.length;j+=0x8000)bin+=String.fromCharCode(...block.subarray(j,Math.min(j+0x8000,block.length)));
  sink.write(btoa(bin));
  if(onBytes)onBytes(block.length);
  if(Date.now()-state.lastYield>60){await tick();state.lastYield=Date.now()}
 }
}
async function writePackedValue(v,sink,onBytes,state){
 if(v instanceof Blob){
  sink.write('{"__offlineType":"Blob","mime":'+JSON.stringify(v.type||'')+',"data":"');
  await writeBlobBase64(v,sink,onBytes,state);
  sink.write('"}');return;
 }
 if(v instanceof ArrayBuffer){
  sink.write('{"__offlineType":"ArrayBuffer","data":"');
  await writeBase64(new Uint8Array(v),sink,onBytes,state);
  sink.write('"}');return;
 }
 if(ArrayBuffer.isView(v)){
  sink.write('{"__offlineType":'+JSON.stringify(v.constructor.name)+',"data":"');
  await writeBase64(new Uint8Array(v.buffer,v.byteOffset,v.byteLength),sink,onBytes,state);
  sink.write('"}');return;
 }
 if(v===null||typeof v==='number'||typeof v==='boolean'||typeof v==='string'){
  if(typeof v==='string'&&onBytes&&v.length>512)onBytes(v.length*2);
  sink.write(typeof v==='number'&&!Number.isFinite(v)?'null':JSON.stringify(v));return;
 }
 if(Array.isArray(v)){
  sink.write('[');
  for(let i=0;i<v.length;i++){if(i)sink.write(',');await writePackedValue(v[i],sink,onBytes,state);if(Date.now()-state.lastYield>50){await tick();state.lastYield=Date.now()}}
  sink.write(']');return;
 }
 if(typeof v==='object'){
  sink.write('{');let first=true;
  for(const [k,x] of Object.entries(v)){
   if(x===undefined||typeof x==='function'||typeof x==='symbol')continue;
   if(!first)sink.write(',');first=false;
   sink.write(JSON.stringify(k)+':');
   await writePackedValue(x,sink,onBytes,state);
   if(Date.now()-state.lastYield>50){await tick();state.lastYield=Date.now()}
  }
  sink.write('}');return;
 }
 sink.write('null');
}
async function unpackValue(v){
  if(Array.isArray(v)){const out=[];for(const x of v)out.push(await unpackValue(x));return out}
  if(v&&typeof v==='object'){
   if(v.__offlineType){const u=await fromB64(v.data||'');if(v.__offlineType==='Blob')return new Blob([u],{type:v.mime||'application/octet-stream'});if(v.__offlineType==='ArrayBuffer')return u.buffer;const C=window[v.__offlineType];if(typeof C==='function'&&C.BYTES_PER_ELEMENT)return new C(u.buffer);return u;}
   const o={};for(const [k,x] of Object.entries(v))o[k]=await unpackValue(x);return o;
  }
  return v;
}
let restoreMode='library';
// Old backups contain the previous lang_symbol_year_issue book ids. Rewrite
// them to the stable id before saving so notes/highlights still line up.
function buildRestoreIdMap(books){
  const idMap=new Map();
  for(const b of books){
    if(!b||!shouldMigrateId(b))continue;
    const old=String(b.id),next=idFor(b);
    if(next===old)continue;
    idMap.set(old,next);b.id=next;
  }
  return idMap;
}
function remapUserDataIds(idMap,notes,highlights,marks,history){
  if(!idMap||!idMap.size)return;
  const noteIdMap=new Map();
  const remapId=(id,oldId,newId)=>{const s=String(id);if(s.startsWith('answer:'+oldId+':'))return 'answer:'+newId+s.slice(('answer:'+oldId).length);if(s.startsWith(oldId+':'))return newId+s.slice(oldId.length);return s};
  for(const n of notes){
    const old=String(n.bookId||''),next=idMap.get(old);if(!next)continue;
    const nid=remapId(n.id,old,next);if(nid!==String(n.id))noteIdMap.set(String(n.id),nid);
    n.id=nid;n.bookId=next;
  }
  for(const h of highlights){
    const old=String(h.bookId||''),next=idMap.get(old);if(!next)continue;
    h.bookId=next;
    if(h.noteId&&noteIdMap.has(String(h.noteId)))h.noteId=noteIdMap.get(String(h.noteId));
  }
  for(const m of marks){const old=String(m.bookId||''),next=idMap.get(old);if(!next)continue;m.id=remapId(m.id,old,next);m.bookId=next}
  for(const h of history){const old=String(h.bookId||''),next=idMap.get(old);if(!next)continue;h.id=remapId(h.id,old,next);h.bookId=next}
}
function remapRestoredIds(books,notes,highlights,marks,history){
  const idMap=buildRestoreIdMap(books);
  remapUserDataIds(idMap,notes,highlights,marks,history);
}
const VAULT_BACKUP_MAGIC='OLVAULT1\n';
let pendingVaultInstall=null;
async function installPendingVault(){
  if(!pendingVaultInstall||lockEnabled())return;
  const pending=pendingVaultInstall;pendingVaultInstall=null;
  await persistLockMeta(pending.lock);
  await setVaultRaw(pending.raw);
  logDiag('info','从加密备份安装应用锁',{format:'offline-library-vault-v1'});
}
async function isVaultBackup(file){try{return (await file.slice(0,VAULT_BACKUP_MAGIC.length).text())===VAULT_BACKUP_MAGIC}catch(e){return false}}
async function decryptVaultBackupFile(file){
  const lenBuf=await file.slice(VAULT_BACKUP_MAGIC.length,VAULT_BACKUP_MAGIC.length+4).arrayBuffer();
  const len=new DataView(lenBuf).getUint32(0);
  const header=JSON.parse(await file.slice(VAULT_BACKUP_MAGIC.length+4,VAULT_BACKUP_MAGIC.length+4+len).text());
  const cipher=new Uint8Array(await file.slice(VAULT_BACKUP_MAGIC.length+4+len).arrayBuffer());
  const secret=prompt(t('输入备份密码或恢复码'));
  if(secret===null)return null;
  const unlocked=await unwrapVaultKeyFromMeta(header.lock,secret);
  const plain=await decryptBytesWithKey(cipher,unlocked.key,'backup');
  if(!lockEnabled())pendingVaultInstall={lock:header.lock,raw:unlocked.raw};
  return new Blob([plain],{type:'application/json'});
}
async function saveBackupBlob(raw,plainName){
  if(!(lockEnabled()&&vaultKey)){download(raw,plainName);return}
  const cipher=await encryptVaultBytes(new Uint8Array(await raw.arrayBuffer()),'backup');
  const header={format:'offline-library-vault-v1',appVersion:APP_VERSION,createdAt:new Date().toISOString(),lock:lockMeta()};
  const hb=new TextEncoder().encode(JSON.stringify(header));
  const len=new Uint8Array(4);new DataView(len.buffer).setUint32(0,hb.length);
  download(new Blob([VAULT_BACKUP_MAGIC,len,hb,cipher],{type:'application/octet-stream'}),plainName.replace(/\.json$/,'')+'.olvault');
}
async function backupNotes(){
  try{
    const [notes,tags,highlights]=await Promise.all([getAllUser('notes'),getAllUser('tags'),getAllUser('highlights')]);
    const data={format:'offline-library-notes-v1',appVersion:APP_VERSION,createdAt:new Date().toISOString(),notes:notes||[],tags:tags||[],highlights:highlights||[]};
    await saveBackupBlob(new Blob([JSON.stringify(data)],{type:'application/json'}),'offline-library-notes-v1.json');
    logDiag('info','导出笔记备份',{notes:(notes||[]).length,tags:(tags||[]).length,highlights:(highlights||[]).length});
  }catch(err){say('备份失败',err.message||String(err));logDiag('error','导出笔记备份失败',{message:err.message||String(err)})}
}
const RESTORE_DERIVED_SYSTEM_IDS=new Set(['canonicalAnchorsV1','migratedV3','migratedStableIds','categoryIdsV1','lockMeta']);
function snapshotLocalStorage(){
  const out={};
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('offlineLibrary')&&k!==LOCK_META_KEY)out[k]=localStorage.getItem(k)}}catch(e){}
  return out;
}
async function snapshotSystemStore(){
  const out=[];
  await new Promise((res,rej)=>{
    const t=idb.transaction('system','readonly');
    const r=t.objectStore('system').openCursor();
    r.onsuccess=e=>{const c=e.target.result;if(c){const v=c.value;if(v&&!RESTORE_DERIVED_SYSTEM_IDS.has(String(v.id)))out.push(v);c.continue()}else res()};
    r.onerror=()=>rej(r.error);
  });
  return out;
}
function applyRestoredSettings(){
  try{
    try{const packs=JSON.parse(localStorage.getItem('offlineLibraryLanguagePacks')||'{}');for(const [code,pack] of Object.entries(packs))registerLanguagePack(code,pack.meta,pack.messages,false)}catch(e){}
    const savedUi=localStorage.getItem('offlineLibraryUiLang');
    if(savedUi&&UI_LANGS[savedUi])uiLang=savedUi;
    const savedContent=localStorage.getItem('offlineLibraryContentLang');
    if(savedContent)contentLangFilter=savedContent;
    const pron=localStorage.getItem('offlineLibraryPronunciation');
    if(pron!==null)setPinyin(pron==='1');
    try{sidebarCollapsed=localStorage.getItem('offlineLibrarySidebarCollapsed')==='1';tocHidden=localStorage.getItem('offlineLibraryTocHidden')==='1';applySidebarState();applyTocState()}catch(e){}
    try{readerSearchSelected=loadReaderSearchSelected()}catch(e){}
    try{const id=localStorage.getItem('offlineLibraryBibleId');if(id)currentBibleId=id}catch(e){}
    applyI18n();
  }catch(e){logDiag('warn','恢复界面设置失败',{message:e&&e.message||String(e)})}
}
async function backupLibrary(){
  try{
    const metas=await allBooks();
    const sourceBytes=await bookSourceTotalBytes();
    const est=metas.reduce((n,m)=>n+Number(m.estimatedSize||0),0)+sourceBytes;
    const sourceMb=Math.round(sourceBytes/1048576);
    if(est>150*1048576&&!(await askConfirm(t('备份整个图书馆'),`此设备上的资料约 ${Math.round(est/1048576)} MB${sourceMb?`（其中原始包约 ${sourceMb} MB）`:''}，导出完整备份可能较慢或失败。`,'继续')))return;
    let done=0,lastPaint=0,bookCount=0,sourceCount=0;
    const paint=(label,force)=>{
      const now=Date.now();
      if(!force&&now-lastPaint<250)return;
      lastPaint=now;
      const pct=est>0?Math.min(100,Math.round(done/est*100)):0;
      say('正在备份图书馆',`${label}\n\n计划：${metas.length} 份出版物${sourceCount?`（含 ${sourceCount} 个原始包）`:''}，约 ${fmtMb(est)}\n已打包：${fmtMb(done)} / ${fmtMb(est)}（${pct}%）\n以上体积为估算值，实际文件会因 Base64 编码而更大。`);
    };
    paint('正在读取笔记、标签和划线…',true);
    await tick();
    const [notes,tags,highlights,marks,history,categories,system,localStorageData]=await Promise.all([getAllUser('notes'),getAllUser('tags'),getAllUser('highlights'),getAllUser('bookmarks'),getAllUser('history'),getAllUser('categories'),snapshotSystemStore(),snapshotLocalStorage()]);
    const sink=createJsonSink(),state={lastYield:Date.now()};
    sink.write('{"format":"offline-library-library-v2","appVersion":'+JSON.stringify(APP_VERSION)+',"createdAt":'+JSON.stringify(new Date().toISOString())+',"books":[');
    for(let i=0;i<metas.length;i++){
      const m=metas[i];
      paint(`正在读取：${m.title||m.id}（${i+1}/${metas.length}）`,true);
      const full=await loadBook(m.id,{assets:true});
      if(!full)continue;
      try{const src=await getBookSource(m.id);if(src){full.__source=src;sourceCount++}}catch(e){}
      const label=`正在打包：${full.title||m.id}（${i+1}/${metas.length}）${full.__source?'，含原始包':''}`;
      paint(label,true);
      if(bookCount)sink.write(',');
      await writePackedValue(full,sink,b=>{done+=b;paint(label)},state);
      bookCount++;
      await tick();
    }
    const tail=[['notes',notes],['tags',tags],['highlights',highlights],['bookmarks',marks],['history',history],['categories',categories],['system',system],['localStorage',localStorageData]];
    sink.write(']');
    for(const [name,value] of tail){
      sink.write(','+JSON.stringify(name)+':');
      await writePackedValue(value||[],sink,()=>{},state);
    }
    sink.write('}');
    paint(`正在生成备份文件（${metas.length} 份出版物、${sourceCount} 个原始包、${(notes||[]).length} 条笔记）…`,true);
    await tick();
    await saveBackupBlob(new Blob(sink.parts(),{type:'application/json'}),'offline-library-library-v2.json');
    try{$('modal').style.display='none'}catch(e){}
    logDiag('info','导出图书馆备份',{format:'offline-library-library-v2',books:bookCount,sources:sourceCount,notes:(notes||[]).length,tags:(tags||[]).length,highlights:(highlights||[]).length,estimatedBytes:est});
  }catch(err){say('备份失败',err.message||String(err));logDiag('error','导出图书馆备份失败',{message:err.message||String(err)})}
}
// Read a v1 library backup one book at a time instead of JSON.parse-ing the
// whole file. A 300-500 MB backup otherwise needs a full text copy plus the
// parsed object tree at once, which crashes mobile/Sitecase tabs.
async function streamLibraryBackup(file,opts={}){
  if(!file||typeof file.stream!=='function')throw new Error('当前浏览器不支持流式恢复；请换用较新的浏览器，或改成分批备份。');
  const reader=file.stream().getReader(),decoder=new TextDecoder();
  let buf='',eof=false,readBytes=0,lastYield=Date.now(),lastProgress=0,bookIndex=0;
  const pull=async()=>{
    const {value,done}=await reader.read();
    if(done){eof=true;buf+=decoder.decode();return false}
    readBytes+=value.byteLength;buf+=decoder.decode(value,{stream:true});
    const now=Date.now();
    if(now-lastYield>50){await tick();lastYield=now}
    if(opts.onProgress&&now-lastProgress>250){lastProgress=now;opts.onProgress(readBytes)}
    return true;
  };
  const skipSep=async()=>{
    while(true){
      if(!buf){if(eof)return false;await pull()}
      let i=0;while(i<buf.length){const c=buf.charCodeAt(i);if(c===44||c===32||c===10||c===13||c===9)i++;else break}
      buf=buf.slice(i);
      if(buf)return true;
      if(eof)return false;
    }
  };
  const readObject=async()=>{
    const parts=[];let depth=0,inStr=false,esc=false;
    while(true){
      if(!buf){if(eof)throw new Error('备份文件意外结束');await pull()}
      let end=0,complete=false;
      for(let i=0;i<buf.length;i++){
        const c=buf.charCodeAt(i);
        if(inStr){
          if(esc)esc=false;
          else if(c===92)esc=true;
          else if(c===34)inStr=false;
        }else{
          if(c===34)inStr=true;
          else if(c===123||c===91)depth++;
          else if(c===125||c===93){depth--;if(depth===0){complete=true;end=i+1;break}}
        }
      }
      if(complete){parts.push(buf.slice(0,end));buf=buf.slice(end);return parts.join('')}
      parts.push(buf);buf='';
      if(eof)throw new Error('备份文件中的出版物数据不完整');
      await pull();
    }
  };
  let head='';
  while(true){
    if(!buf){if(eof)throw new Error('不是完整的图书馆备份文件');await pull()}
    const m=buf.match(/"books"\s*:\s*\[/);
    if(m){head+=buf.slice(0,m.index);buf=buf.slice(m.index+m[0].length);break}
    // Keep a small overlap so a "books":[ split across two chunks is found.
    if(buf.length>128){head+=buf.slice(0,buf.length-128);buf=buf.slice(buf.length-128)}
    if(head.length>1048576)throw new Error('备份文件头部异常');
    if(eof)throw new Error('备份文件里没有 books 数组');
    await pull();
  }
  const format=(head.match(/"format"\s*:\s*"([^"]+)"/)||[])[1]||'';
  if(opts.onFormat)await opts.onFormat(format,head);
  while(true){
    const has=await skipSep();
    if(!has)throw new Error('备份中的 books 数组不完整');
    if(buf[0]===']'){buf=buf.slice(1);break}
    if(buf[0]!=='{')throw new Error('备份中的出版物数据格式不正确');
    const text=await readObject();
    bookIndex++;
    let book=null;
    try{book=JSON.parse(text)}catch(e){throw new Error(`第 ${bookIndex} 本出版物数据损坏：${e.message||e}`)}
    await opts.onBook(book,bookIndex);
  }
  let tail=buf;buf='';
  while(!eof){await pull();tail+=buf;buf=''}
  let data={books:[]};
  if(tail.trim())data=JSON.parse('{"books":[]'+tail);
  if(opts.onProgress)opts.onProgress(readBytes);
  return {format,bookCount:bookIndex,readBytes,tail:data};
}
async function refreshCanonicalAnchorsAfterRestore(){
  try{await reqP(tx('system','readwrite').delete('canonicalAnchorsV1'))}catch(e){}
  try{await ensureCanonicalAnchors()}catch(e){}
}
function startRestore(mode){restoreMode=mode==='notes'?'notes':'library';try{$('backupInput').value=''}catch(e){};$('backupInput').click()}
$('backupInput').onchange=async e=>{
  let restoreFormat='';
  try{
    let f=e.target.files[0];if(!f)return;
    pendingVaultInstall=null;
    if(await isVaultBackup(f)){
      const decrypted=await decryptVaultBackupFile(f);
      if(!decrypted)return;
      f=decrypted;
    }
    const libraryFormats=['offline-library-backup-v1','offline-library-backup-v2','offline-library-backup-v3','offline-library-library-v1','offline-library-library-v2'];
    if(restoreMode==='notes'){
      let head='';try{head=await f.slice(0,4096).text()}catch(err){}
      if(!/"format"\s*:\s*"offline-library-notes-v1"/.test(head))throw new Error('这是图书馆备份，请使用“恢复整个图书馆”。');
      const d=JSON.parse(await f.text());
      if(d.format!=='offline-library-notes-v1')throw new Error('备份文件格式不正确');
      restoreFormat=d.format;
      await installPendingVault();
      const notes=d.notes||[],tags=d.tags||[],highlights=d.highlights||[];
      for(const tg of tags)await saveOne('tags',tg);
      for(const n of notes)await saveOne('notes',n);
      for(const h of highlights)await saveOne('highlights',h);
      await refreshCanonicalAnchorsAfterRestore();
      await renderBooks();
      say('恢复完成',`恢复笔记 ${notes.length} 条、标签 ${tags.length} 个、划线 ${highlights.length} 条。`);
      logDiag('info','恢复笔记备份',{format:d.format,notes:notes.length,tags:tags.length,highlights:highlights.length});
      return;
    }
    if(!(await askConfirm(t('恢复整个图书馆'),'恢复整个图书馆会按出版物 ID 覆盖/合并此设备上的记录，并导入笔记、标签、划线、书签和阅读历史。','继续')))return;
    await installPendingVault();
    say('正在恢复图书馆','正在读取备份文件…',true);await tick();
    let idMap=new Map(),bookCount=0,readBytes=0,sourceCount=0;
    const result=await streamLibraryBackup(f,{
      onFormat:(format)=>{restoreFormat=format;if(format==='offline-library-notes-v1')throw new Error('这是笔记备份，请使用“恢复笔记”。');if(!libraryFormats.includes(format))throw new Error('备份文件格式不正确')},
      onProgress:(bytes)=>{readBytes=bytes;say('正在恢复图书馆',`正在读取备份…\n${fmtMb(bytes)} / ${fmtMb(f.size)}`,true)},
      onBook:async(book,bookIndex)=>{
        const full=await unpackValue(book);
        const source=full&&full.__source?full.__source:null;
        if(full&&'__source'in full)delete full.__source;
        const oldId=full.id;
        const map=buildRestoreIdMap([full]);map.forEach((v,k)=>idMap.set(k,v));
        if(!full.categoryPath)full.categoryPath=classifyPublication(full);
        // Source-first books have no parsed body. Save the package first so a
        // failed package write cannot leave an empty, unreadable book behind.
        if(source){
          try{await saveBookSource(full.id,source)}
          catch(err){throw new Error(`第 ${bookIndex} 本原始包恢复失败：${err&&err.message||String(err)}`)}
        }
        try{await persistBook(full)}
        catch(err){if(source){try{await deleteBookSource(full.id)}catch(e){}};throw err}
        if(source){sourceCount++;await markBookSource(full.id,source)}
        if(String(oldId)!==String(full.id))await deleteBookSource(oldId);
        bookCount++;
        say('正在恢复图书馆',`正在读取备份…\n已恢复 ${bookCount} 本 · ${fmtMb(readBytes)} / ${fmtMb(f.size)}`,true);
      }
    });
    let notes=await unpackValue(result.tail.notes||[]),tags=await unpackValue(result.tail.tags||[]),highlights=await unpackValue(result.tail.highlights||[]),marks=await unpackValue(result.tail.bookmarks||[]),history=await unpackValue(result.tail.history||[]),categories=await unpackValue(result.tail.categories||[]);
    remapUserDataIds(idMap,notes,highlights,marks,history);
    for(const tg of tags)await saveOne('tags',tg);
    for(const n of notes)await saveOne('notes',n);
    for(const h of highlights)await saveOne('highlights',h);
    for(const m of marks)await saveOne('bookmarks',m);
    for(const h of history)await saveOne('history',h);
    for(const c of categories)await saveOne('categories',c);
    const system=await unpackValue(result.tail.system||[]);
    const localData=await unpackValue(result.tail.localStorage||{});
    for(const rec of system)await saveOne('system',rec);
    for(const [k,v] of Object.entries(localData||{}))try{localStorage.setItem(k,String(v))}catch(e){}
    applyRestoredSettings();
    await loadReaderCache();
    await refreshCanonicalAnchorsAfterRestore();
    await renderBooks();
    say('恢复完成',`恢复/合并出版物 ${bookCount} 本${sourceCount?`（含原始包 ${sourceCount} 个）`:''}、笔记 ${notes.length} 条、标签 ${tags.length} 个、划线 ${highlights.length} 条、书签 ${marks.length} 条、阅读记录 ${history.length} 条；界面设置/语言包/阅读位置已恢复。`);
    logDiag('info','恢复备份',{format:restoreFormat,books:bookCount,sources:sourceCount,notes:notes.length,tags:tags.length,highlights:highlights.length,system:system.length,localStorage:Object.keys(localData||{}).length});
  }catch(err){say('恢复失败',err.message||String(err));logDiag('error','恢复备份失败',{message:err.message||String(err),format:restoreFormat})}finally{e.target.value=''}
};
function isIOSWebView(){
  try{return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}catch(e){return false}
}
function isMobileWebView(){
  try{
    const ua=navigator.userAgent||'';
    if(/iPad|iPhone|iPod|Android/i.test(ua))return true;
    if(Number(navigator.maxTouchPoints||0)>1&&/Macintosh|Mac OS X/i.test(ua))return true;
    return Number(navigator.maxTouchPoints||0)>1&&!/Windows|Linux/i.test(ua);
  }catch(e){return false}
}
function closeExportPanel(){const p=document.getElementById('exportPanel');if(p)p.remove()}
async function saveBlobAsFile(blob,name){
  if(typeof window.showSaveFilePicker==='function'){
    try{
      const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'JWPUB',accept:{'application/octet-stream':['.jwpub']}}]});
      const writable=await handle.createWritable();
      await writable.write(blob);await writable.close();return true;
    }catch(e){if(e&&e.name==='AbortError')return true}
  }
  if(isMobileWebView())return false;
  download(blob,name);return true;
}
function showExportPanel(blob,name,book,exact){
  closeExportPanel();
  const mobileShare=isMobileWebView();
  const panel=document.createElement('div');panel.id='exportPanel';
  panel.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:20px';
  panel.onclick=e=>{if(e.target===panel)closeExportPanel()};
  const box=document.createElement('div');box.style.cssText='background:#fff;color:#172026;border-radius:14px;padding:18px;max-width:440px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.28);font:14px/1.5 system-ui,-apple-system,sans-serif';
  const title=document.createElement('div');title.style.cssText='font-weight:700;font-size:16px;margin-bottom:8px';title.textContent=t('分享 / 保存');
  const fileLabel=document.createElement('div');fileLabel.style.cssText='font-size:12px;color:#5d7079;word-break:break-all;margin-bottom:12px';fileLabel.textContent=name;
  const hint=document.createElement('div');hint.style.cssText='font-size:12px;color:#5d7079;line-height:1.5;margin-bottom:14px';hint.textContent=mobileShare?t('在分享面板选择“存储到文件”，再从“文件”App 分享给 JW Library。'):'';
  const actions=document.createElement('div');actions.style.cssText='display:flex;flex-direction:column;gap:8px';
  const mk=(label,fn,secondary)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:11px 14px;border-radius:10px;border:1px solid '+(secondary?'#d8dee4':'#172026')+';background:'+(secondary?'#fff':'#172026')+';color:'+(secondary?'#172026':'#fff')+';font:inherit;font-weight:650';b.onclick=fn;actions.appendChild(b);return b};
  if(mobileShare){
    mk(t('分享 / 保存…'),async()=>{
      if(typeof File!=='function'){closeExportPanel();say(t('无法直接分享'),t('当前容器无法分享文件，请改用桌面浏览器保存，或从文件 App 分享。'));return}
      const fileObj=new File([blob],name,{type:'application/octet-stream'});
      let can=false;try{can=!!(navigator.canShare&&navigator.share&&navigator.canShare({files:[fileObj]}))}catch(e){}
      if(can){
        const p=navigator.share({files:[fileObj]});
        closeExportPanel();
        try{await p;logDiag('info','分享原始 JWPUB',{id:book.id,size:blob.size,name,exact:!!exact})}
        catch(e){if(e&&e.name!=='AbortError')say(t('无法直接分享'),t('当前容器无法分享文件，请改用桌面浏览器保存，或从文件 App 分享。'))}
        return;
      }
      closeExportPanel();
      const ok=await saveBlobAsFile(blob,name);
      if(!ok)say(t('无法直接分享'),t('当前容器无法分享文件，请改用桌面浏览器保存，或从文件 App 分享。'));
    });
  }else{
    mk(t('保存到文件…'),async()=>{closeExportPanel();await saveBlobAsFile(blob,name);logDiag('info','保存原始 JWPUB',{id:book.id,size:blob.size,name,exact:!!exact})});
  }
  mk(t('取消'),closeExportPanel,true);
  box.append(title,fileLabel,hint,actions);panel.appendChild(box);document.body.appendChild(panel);
}
function exportBookFileName(book,src,mode){
  const original=String((src&&src.name)||book.originalFilename||book.manifestName||'').trim();
  const readable=String(book.displayTitle||book.title||'').trim();
  let base=mode==='readable'?(readable||original):(original||readable);
  base=base.replace(/\.(jwpub|pub)$/i,'').replace(/[\\/:*?"<>|\x00-\x1f]+/g,'_').trim()||'publication';
  return base+'.jwpub';
}
async function exportBookJwpub(book,mode='original'){
  try{
    const src=await getBookSource(book.id);
    if(!src){say(t('导出失败'),t('没有保存原始包。请重新导入原 PUB。'));return}
    const name=exportBookFileName(book,src,mode);
    if(src.jwpub){
      const exact=src.jwpub instanceof Blob?src.jwpub:new Blob([src.jwpub]);
      showExportPanel(exact,name,book,true);
      return;
    }
    say(t('正在生成 JWPUB'),t('正在打包…'),true);await tick();
    let contentsBlob=src.innerZip||null;
    if(contentsBlob&&!(contentsBlob instanceof Blob))contentsBlob=new Blob([contentsBlob]);
    if(!contentsBlob){
      if(!src.db)throw new Error('原始包缺少 SQLite 和内层文件。');
      const dbBytes=new Uint8Array(await src.db.arrayBuffer());
      const inner=new JSZip();
      inner.file(src.dbName||'publication.db',dbBytes);
      for(const f of src.files||[])inner.file(f.name,f.blob);
      contentsBlob=await inner.generateAsync({type:'blob',compression:'DEFLATE'});
    }
    const outer=new JSZip();
    outer.file('manifest.json',src.manifestBytes);
    outer.file('contents',contentsBlob);
    for(const f of src.outerFiles||[])outer.file(f.name,f.blob);
    const blob=await outer.generateAsync({type:'blob',compression:'DEFLATE'});
    try{$('modal').style.display='none'}catch(e){}
    showExportPanel(blob,name,book,false);
  }catch(err){say(t('导出失败'),err.message||String(err));logDiag('error','导出原始 JWPUB 失败',{id:book.id,message:err.message||String(err)})}
}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();const t=setTimeout(()=>URL.revokeObjectURL(u),600000);try{if(t&&t.unref)t.unref()}catch(e){}}
const APP_UPDATE_NOTES=[
  '2.1.0 · 应用锁/恢复码/加密备份',
  '2.0.1 · 安全加固/恢复顺序/构建检查/分享修复',
  '2.0 · 原始包分享/重新导入/备份 v2/搜索范围分组/source-first',
  '1.0 · 统一阅读器题头/栏目位置恢复/相关链接浮窗/笔记标记/每日经文分页',
  '0.14 · 界面一致性/统一图标与菜单/使用说明/无障碍',
  '0.13 · 圣经/出版物全文搜索/最近搜索/搜索结果返回',
  '0.12 · 圣经串珠/经文信息/单节复制/经文笔记',
  '0.11 · 可收起笔记编辑器/撤销重做/栏目位置恢复',
  '0.10 · 稳定分类 ID/自定义分类/分类管理',
  '0.9 · 界面与内容语言分离/语言版本切换/跨语言笔记',
  '0.8 · 个人研读/标签/高亮笔记/稳定 ID/流式备份恢复',
  '0.7 · 多语言界面/拼音/滑动翻页/聚会周切换',
  '0.6 · 五栏目导航/首页每日经文/圣经分步浏览',
  '0.5 · 拆分存储/解析容错/诊断与自动测试',
  '0.4 · 桌面三栏阅读/多种阅读样式/注释支持',
  '0.3 · 模块化源码/批量导入/阅读历史/备份'
];
async function showAbout(){
  try{
    const d=await buildDiagnostics();
    const storage=d.storage?`${fmtMb(d.storage.usage)} / ${fmtMb(d.storage.quota)}`:'—';
    const lines=[
      `${t('应用版本')}：${d.appVersion}`,
      `${t('数据库版本')}：${d.dbName} v${d.dbVersion}`,
      `${t('存储')}：${storage}`,
      `${t('出版物')}：${d.books.length} · ${t('笔记')}：${d.counts.notes} · ${t('划线')}：${d.counts.highlights??'—'}`,
      '',
      `${t('更新记录')}：`,
      ...APP_UPDATE_NOTES,
      '',
      t('离线应用不会联网检查更新；更新时请用新的单 HTML 文件替换，并先导出备份。')
    ];
    say(t('设置与关于'),lines.join('\n'));
  }catch(e){say(t('设置与关于'),e.message||String(e))}
}
let appBooted=false;
function showLockScreen(message=''){
  const screen=$('lockScreen');if(!screen)return;
  screen.hidden=false;screen.style.display='flex';
  const err=$('lockError');if(err)err.textContent=message||'';
  const pw=$('lockPassword'),rc=$('lockRecovery');
  if(pw){pw.hidden=false;pw.value='';try{pw.focus()}catch(e){}}
  if(rc){rc.hidden=true;rc.value=''}
  const hint=$('lockHint');if(hint)hint.textContent=t('输入密码继续');
}
function hideLockScreen(){const screen=$('lockScreen');if(screen){screen.hidden=true;screen.style.display='none'}}
function lockNow(){
  if(!lockEnabled())return;
  clearVaultKey();
  try{closeSourceDbs()}catch(e){}
  try{document.getElementById('vaultPanel')?.remove();document.getElementById('exportPanel')?.remove()}catch(e){}
  bookLoadCache.clear();
  currentBook=null;currentIndex=0;
  studyState={books:[],tags:[],notes:[],query:'',tagFilter:new Set()};
  try{CUSTOM_CATEGORIES.clear()}catch(e){}
  try{publicationSearchCache.clear();bibleSearchCache.clear();readerLangCache={key:'',at:0,list:[]}}catch(e){}
  annotationState=null;noteEditorState=null;contextActionState=null;verseActionState=null;blockActionState=null;
  try{clearUrls()}catch(e){}
  try{$('article').innerHTML='';$('annotationsList').innerHTML='';$('historyList').innerHTML='';$('readerSearchResults').innerHTML='';$('readerSearchRecent').innerHTML=''}catch(e){}
  try{$('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid'}catch(e){}
  showLockScreen();
}
async function resetAllAppData(){
  clearVaultKey();
  try{closeSourceDbs()}catch(e){}
  try{if(sourceDbPromise){const sdb=await sourceDbPromise;if(sdb)sdb.close()}}catch(e){}
  try{idb&&idb.close()}catch(e){}
  await new Promise(res=>{const r=indexedDB.deleteDatabase(DB_NAME);r.onsuccess=r.onerror=r.onblocked=()=>res()});
  await new Promise(res=>{const r=indexedDB.deleteDatabase(SOURCE_DB_NAME);r.onsuccess=r.onerror=r.onblocked=()=>res()});
  try{for(const k of Object.keys(localStorage))if(k.startsWith('offlineLibrary'))localStorage.removeItem(k)}catch(e){}
  location.reload();
}
async function enterAppFromLock(){
  hideLockScreen();
  if(!appBooted){await bootApp();return}
  try{await loadReaderCache();await renderBooks();}catch(e){say(t('无法解锁'),e.message||String(e))}
}
function bindLockUI(){
  const unlock=$('lockUnlock'),recovery=$('lockUseRecovery'),reset=$('lockReset');
  if(!unlock)return;
  unlock.onclick=async()=>{
    const err=$('lockError');if(err)err.textContent='';
    const pw=$('lockPassword'),rc=$('lockRecovery');
    const usingRecovery=rc&&!rc.hidden;
    const secret=usingRecovery?rc.value:pw.value;
    try{
      if(usingRecovery)await unlockVaultWithRecovery(secret);else await unlockVaultWithPassword(secret);
      await enterAppFromLock();
    }catch(e){if(err)err.textContent=t('密码或恢复码不正确')}
  };
  if(recovery)recovery.onclick=()=>{
    const pw=$('lockPassword'),rc=$('lockRecovery'),hint=$('lockHint');
    const usingRecovery=rc&&rc.hidden;
    if(rc)rc.hidden=!usingRecovery;
    if(pw)pw.hidden=usingRecovery;
    if(hint)hint.textContent=usingRecovery?t('输入恢复码继续'):t('输入密码继续');
    try{(usingRecovery?rc:pw).focus()}catch(e){}
  };
  if(reset)reset.onclick=async()=>{
    if(!(await askConfirm(t('忘记密码'),t('没有恢复码时只能清空全部出版物、笔记和设置。请先确认已经备份。继续？'),t('清空'))))return;
    if(!(await askConfirm(t('清空全部数据'),t('这会删除本机所有图书馆数据，无法撤销。'),t('清空'))))return;
    await resetAllAppData();
  };
  for(const id of ['lockPassword','lockRecovery']){const el=$(id);if(el)el.addEventListener('keydown',e=>{if(e.key==='Enter')unlock.click()})}
}
async function enableVault(password,timeout){
  if(lockEnabled()&&!vaultKey)throw new Error(t('应用锁已启用，请先解锁'));
  const missing=await auditPlaintextBooks();
  if(missing.length)throw new Error(`${t('以下出版物没有原始包，请先重新导入')}：${missing.slice(0,5).join('、')}${missing.length>5?'…':''}`);
  await stripAllSourceBooks();
  let recovery=null;
  if(!lockEnabled())recovery=await createVaultLock(password,timeout);
  await encryptExistingSources();
  await sealExistingUserData();
  closeSourceDbs();
  return recovery;
}
function showVaultPanel(html,onReady){
  document.getElementById('vaultPanel')?.remove();
  const panel=document.createElement('div');panel.id='vaultPanel';
  panel.style.cssText='position:fixed;inset:0;z-index:200001;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;padding:20px';
  panel.onclick=e=>{if(e.target===panel)panel.remove()};
  const box=document.createElement('div');box.style.cssText='background:#fff;color:#172026;border-radius:16px;padding:22px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.28);font:14px/1.55 system-ui,-apple-system,sans-serif';
  box.innerHTML=html;panel.appendChild(box);document.body.appendChild(panel);
  if(onReady)onReady(box,panel);
}
function showRecoveryCode(code){
  showVaultPanel(`<h2 style="margin:0 0 8px">${t('保存恢复码')}</h2><div class="status">${t('恢复码只显示一次，请离线保存。忘记密码时用它重置并保留数据。')}</div><div class="lock-recovery-code">${safeText(code)}</div><div class="modal-actions"><button class="btn secondary" id="vaultCopy">${t('复制')}</button><button class="btn" id="vaultDone">${t('我已保存')}</button></div>`,(box,panel)=>{
    box.querySelector('#vaultCopy').onclick=async()=>{try{await copyText(code);say(t('已复制'),t('恢复码已复制到剪贴板。'))}catch(e){}};
    box.querySelector('#vaultDone').onclick=()=>panel.remove();
  });
}
function showLockSetup(firstRun=false){
  showVaultPanel(`<h2 style="margin:0 0 8px">${t('设置应用密码')}</h2><div class="status">${t('密码至少 6 位。启用后数据会加密，请先导出备份。')}</div><input class="lock-input" id="vaultPw" type="password" autocomplete="new-password" placeholder="${t('密码')}" style="margin:8px 0"><input class="lock-input" id="vaultPw2" type="password" autocomplete="new-password" placeholder="${t('再次输入密码')}" style="margin:8px 0"><label class="sub" style="display:flex;gap:8px;align-items:center">${t('后台自动锁定')} <select id="vaultTimeout"><option value="5">5 ${t('分钟')}</option><option value="15">15 ${t('分钟')}</option><option value="30">30 ${t('分钟')}</option><option value="60">60 ${t('分钟')}</option></select></label><div class="lock-error" id="vaultErr" role="alert"></div><div class="modal-actions"><button class="btn secondary" id="vaultCancel">${t('取消')}</button><button class="btn" id="vaultCreate">${t('启用应用锁')}</button></div>`,(box,panel)=>{
    box.querySelector('#vaultCancel').onclick=()=>{panel.remove();if(firstRun)localStorage.setItem('offlineLibraryLockPrompted','1')};
    box.querySelector('#vaultCreate').onclick=async()=>{
      const pw=box.querySelector('#vaultPw').value,pw2=box.querySelector('#vaultPw2').value,err=box.querySelector('#vaultErr'),btn=box.querySelector('#vaultCreate');
      if(!pw||pw.length<6){err.textContent=t('密码至少需要 6 位');return}
      if(pw!==pw2){err.textContent=t('两次密码不一致');return}
      btn.disabled=true;err.textContent='';
      try{
        const timeout=Number(box.querySelector('#vaultTimeout').value)||5;
        const recovery=await enableVault(pw,timeout);
        panel.remove();localStorage.setItem('offlineLibraryLockPrompted','1');
        if(recovery)showRecoveryCode(recovery);else say(t('应用锁'),t('应用锁已启用。请用密码解锁后重新生成恢复码。'));
        await renderBooks();
      }catch(e){err.textContent=e.message||String(e);btn.disabled=false}
    };
  });
}
function showLockSettings(){
  if(!lockEnabled()){showLockSetup(false);return}
  showVaultPanel(`<h2 style="margin:0 0 8px">${t('应用锁')}</h2><div class="modal-actions" style="flex-direction:column"><button class="btn secondary" id="vaultChangePw">${t('更改密码')}</button><button class="btn secondary" id="vaultNewRecovery">${t('重新生成恢复码')}</button><button class="btn secondary" id="vaultLockNow">${t('立即锁定')}</button><button class="btn ghost" id="vaultClose">${t('取消')}</button></div>`,(box,panel)=>{
    box.querySelector('#vaultClose').onclick=()=>panel.remove();
    box.querySelector('#vaultLockNow').onclick=()=>{panel.remove();lockNow()};
    box.querySelector('#vaultChangePw').onclick=async()=>{
      const pw=prompt(t('新密码（至少 6 位）'));if(!pw)return;const pw2=prompt(t('再次输入新密码'));if(pw!==pw2){say(t('更改密码'),t('两次密码不一致'));return}
      try{await changeVaultPassword(pw);say(t('更改密码'),t('密码已更改。'))}catch(e){say(t('更改密码'),e.message||String(e))}
    };
    box.querySelector('#vaultNewRecovery').onclick=async()=>{
      if(!(await askConfirm(t('重新生成恢复码'),t('旧恢复码将立即失效。继续？'),t('继续'))))return;
      try{const code=await regenerateVaultRecovery();panel.remove();showRecoveryCode(code)}catch(e){say(t('重新生成恢复码'),e.message||String(e))}
    };
  });
}
async function bootApp(){
  try{
    applyI18n();await openDB();await ensureMigrated();await ensureCategoryIds();
    await loadReaderCache();
    await renderBooks();
    const startTab=readerCacheTab||'home';
    if(startTab!=='home')await setPrimaryNav(startTab,{});
    else if(sectionViews.home)await activateTab('home',false,{});
    appBooted=true;
    if(!lockEnabled()&&!localStorage.getItem('offlineLibraryLockPrompted')){
      localStorage.setItem('offlineLibraryLockPrompted','1');
      setTimeout(()=>{if(!lockEnabled())showLockSetup(true)},400);
    }
  }catch(e){say('本地存储不可用','当前浏览器或容器未允许本地存储，无法保存图书：'+e.message)}
}
const _settingsBtn=$('settingsBtn');if(_settingsBtn)_settingsBtn.onclick=showAbout;
window.addEventListener('pagehide',()=>{saveReaderCache().catch(()=>{});closeSourceDbs();if(lockEnabled()&&vaultKey)lockHiddenAt=Date.now()});
window.addEventListener('pageshow',()=>{
  if(lockEnabled()&&vaultKey&&lockHiddenAt){
    const mins=Number((lockMeta()||{}).timeout||5);
    if(Date.now()-lockHiddenAt>=mins*60000)lockNow();
    lockHiddenAt=0;
  }
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){
    saveReaderCache().catch(()=>{});
    if(lockEnabled()&&vaultKey)lockHiddenAt=Date.now();
    return;
  }
  if(lockEnabled()&&vaultKey&&lockHiddenAt){
    const mins=Number((lockMeta()||{}).timeout||5);
    if(Date.now()-lockHiddenAt>=mins*60000)lockNow();
    lockHiddenAt=0;
  }
});
(async()=>{
  applyI18n();bindLockUI();
  if(!lockMeta())await ensureLockMetaLoaded();
  if(lockEnabled()&&!vaultKey){showLockScreen();return}
  await bootApp();
})();
})();
