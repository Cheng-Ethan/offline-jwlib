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
async function writePackedValue(v,sink,onBytes,state){
 if(v instanceof Blob){
  const buf=await v.arrayBuffer();
  sink.write('{"__offlineType":"Blob","mime":'+JSON.stringify(v.type||'')+',"data":"');
  await writeBase64(new Uint8Array(buf),sink,onBytes,state);
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
async function backupNotes(){
  try{
    const [notes,tags,highlights]=await Promise.all([reqP(tx('notes').getAll()),reqP(tx('tags').getAll()),reqP(tx('highlights').getAll())]);
    const data={format:'offline-library-notes-v1',appVersion:APP_VERSION,createdAt:new Date().toISOString(),notes:notes||[],tags:tags||[],highlights:highlights||[]};
    download(new Blob([JSON.stringify(data)],{type:'application/json'}),'offline-library-notes-v1.json');
    logDiag('info','导出笔记备份',{notes:(notes||[]).length,tags:(tags||[]).length,highlights:(highlights||[]).length});
  }catch(err){say('备份失败',err.message||String(err));logDiag('error','导出笔记备份失败',{message:err.message||String(err)})}
}
async function backupLibrary(){
  try{
    const metas=await allBooks();const est=metas.reduce((n,m)=>n+Number(m.estimatedSize||0),0);
    if(est>150*1048576&&!(await askConfirm(t('备份整个图书馆'),`此设备上的资料约 ${Math.round(est/1048576)} MB，导出完整备份可能较慢或失败。`,'继续')))return;
    let done=0,lastPaint=0,bookCount=0;
    const paint=(label,force)=>{
      const now=Date.now();
      if(!force&&now-lastPaint<250)return;
      lastPaint=now;
      const pct=est>0?Math.min(100,Math.round(done/est*100)):0;
      say('正在备份图书馆',`${label}\n\n计划：${metas.length} 份出版物，约 ${fmtMb(est)}\n已打包：${fmtMb(done)} / ${fmtMb(est)}（${pct}%）\n以上体积为估算值，实际文件会因 Base64 编码而更大。`);
    };
    paint('正在读取笔记、标签和划线…',true);
    await tick();
    const [notes,tags,highlights,marks,history,categories]=await Promise.all([reqP(tx('notes').getAll()),reqP(tx('tags').getAll()),reqP(tx('highlights').getAll()),reqP(tx('bookmarks').getAll()),reqP(tx('history').getAll()),reqP(tx('categories').getAll())]);
    const sink=createJsonSink(),state={lastYield:Date.now()};
    sink.write('{"format":"offline-library-library-v1","appVersion":'+JSON.stringify(APP_VERSION)+',"createdAt":'+JSON.stringify(new Date().toISOString())+',"books":[');
    for(let i=0;i<metas.length;i++){
      const m=metas[i];
      paint(`正在读取：${m.title||m.id}（${i+1}/${metas.length}）`,true);
      const full=await loadBook(m.id,{assets:true});
      if(!full)continue;
      const label=`正在打包：${full.title||m.id}（${i+1}/${metas.length}）`;
      paint(label,true);
      if(bookCount)sink.write(',');
      await writePackedValue(full,sink,b=>{done+=b;paint(label)},state);
      bookCount++;
      await tick();
    }
    const tail=[['notes',notes],['tags',tags],['highlights',highlights],['bookmarks',marks],['history',history],['categories',categories]];
    sink.write(']');
    for(const [name,value] of tail){
      sink.write(','+JSON.stringify(name)+':');
      await writePackedValue(value||[],sink,()=>{},state);
    }
    sink.write('}');
    paint(`正在生成备份文件（${metas.length} 份出版物、${(notes||[]).length} 条笔记）…`,true);
    await tick();
    download(new Blob(sink.parts(),{type:'application/json'}),'offline-library-library-v1.json');
    try{$('modal').style.display='none'}catch(e){}
    logDiag('info','导出图书馆备份',{books:bookCount,notes:(notes||[]).length,tags:(tags||[]).length,highlights:(highlights||[]).length,estimatedBytes:est});
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
    const f=e.target.files[0];if(!f)return;
    const libraryFormats=['offline-library-backup-v1','offline-library-backup-v2','offline-library-backup-v3','offline-library-library-v1'];
    if(restoreMode==='notes'){
      let head='';try{head=await f.slice(0,4096).text()}catch(err){}
      if(!/"format"\s*:\s*"offline-library-notes-v1"/.test(head))throw new Error('这是图书馆备份，请使用“恢复整个图书馆”。');
      const d=JSON.parse(await f.text());
      if(d.format!=='offline-library-notes-v1')throw new Error('备份文件格式不正确');
      restoreFormat=d.format;
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
    say('正在恢复图书馆','正在读取备份文件…',true);await tick();
    let idMap=new Map(),bookCount=0,readBytes=0;
    const result=await streamLibraryBackup(f,{
      onFormat:(format)=>{restoreFormat=format;if(format==='offline-library-notes-v1')throw new Error('这是笔记备份，请使用“恢复笔记”。');if(!libraryFormats.includes(format))throw new Error('备份文件格式不正确')},
      onProgress:(bytes)=>{readBytes=bytes;say('正在恢复图书馆',`正在读取备份…\n${fmtMb(bytes)} / ${fmtMb(f.size)}`,true)},
      onBook:async(book)=>{
        const full=await unpackValue(book);
        const map=buildRestoreIdMap([full]);map.forEach((v,k)=>idMap.set(k,v));
        if(!full.categoryPath)full.categoryPath=classifyPublication(full);
        await persistBook(full);bookCount++;
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
    await refreshCanonicalAnchorsAfterRestore();
    await renderBooks();
    say('恢复完成',`恢复/合并出版物 ${bookCount} 本、笔记 ${notes.length} 条、标签 ${tags.length} 个、划线 ${highlights.length} 条、书签 ${marks.length} 条、阅读记录 ${history.length} 条。`);
    logDiag('info','恢复备份',{format:restoreFormat,books:bookCount,notes:notes.length,tags:tags.length,highlights:highlights.length});
  }catch(err){say('恢复失败',err.message||String(err));logDiag('error','恢复备份失败',{message:err.message||String(err),format:restoreFormat})}finally{e.target.value=''}
};
async function shareOrDownload(blob,name){
  try{
    if(typeof File==='function'&&navigator.canShare&&navigator.share){
      const file=new File([blob],name,{type:'application/octet-stream'});
      if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return}
    }
  }catch(e){if(e&&e.name==='AbortError')return}
  download(blob,name);
}
function exportBookFileName(book){
  const base=String(book.displayTitle||book.title||book.originalFilename||'publication').replace(/\.(jwpub|pub)$/i,'').replace(/[\\/:*?"<>|]+/g,'_').trim()||'publication';
  return base+'.jwpub';
}
async function exportBookJwpub(book){
  try{
    const src=await getBookSource(book.id);
    if(!src){say(t('导出失败'),t('没有保存原始包。请重新导入原 PUB。'));return}
    if(src.jwpub){
      const exact=src.jwpub instanceof Blob?src.jwpub:new Blob([src.jwpub]);
      const name=exportBookFileName(book);
      await shareOrDownload(exact,name);
      logDiag('info','导出原始 JWPUB',{id:book.id,size:exact.size,exact:true});
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
    const name=exportBookFileName(book);
    await shareOrDownload(blob,name);
    try{$('modal').style.display='none'}catch(e){}
    logDiag('info','导出原始 JWPUB',{id:book.id,size:blob.size,innerZip:!!src.innerZip});
  }catch(err){say(t('导出失败'),err.message||String(err));logDiag('error','导出原始 JWPUB 失败',{id:book.id,message:err.message||String(err)})}
}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();const t=setTimeout(()=>URL.revokeObjectURL(u),600000);try{if(t&&t.unref)t.unref()}catch(e){}}
const APP_UPDATE_NOTES=[
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
const _settingsBtn=$('settingsBtn');if(_settingsBtn)_settingsBtn.onclick=showAbout;
window.addEventListener('pagehide',()=>{saveReaderCache().catch(()=>{})});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveReaderCache().catch(()=>{})});
(async()=>{
  try{
    applyI18n();await openDB();await ensureMigrated();await ensureCategoryIds();
    await loadReaderCache();
    await renderBooks();
    // Resume the tab the user was in. If that tab had an article open, its
    // saved paragraph position is restored instead of starting at the top.
    const startTab=readerCacheTab||'home';
    if(startTab!=='home')await setPrimaryNav(startTab,{});
    else if(sectionViews.home)await activateTab('home',false,{});
  }catch(e){say('本地存储不可用','当前浏览器或容器未允许本地存储，无法保存图书：'+e.message)}
})();
})();
