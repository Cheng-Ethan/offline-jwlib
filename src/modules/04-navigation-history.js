function buildToc(){
  const box=$('tocList'),desktop=$('desktopTocList');box.innerHTML='';if(desktop)desktop.innerHTML='';
  (currentBook.toc||[]).forEach(item=>{
    const el=document.createElement('div');
    el.className='tocitem '+(item.group?'group':'')+(!item.group&&normId(item.docId)===normId(currentBook.docs[currentIndex]?.id)?' active':'');
    el.style.paddingLeft=(10+(item.depth||0)*16)+'px';el.textContent=item.title;
    const bookNum=item.group?bibleTocBookNumber(item.title):0;
    if(bookNum)el.classList.add('toc-book-link');
    const activate=()=>{
      if(!item.group){const ix=currentBook.docs.findIndex(d=>d.id===item.docId);if(ix>=0){pushReaderHistory(readerOriginSection||primarySection);currentIndex=ix;showDoc();buildToc();$('drawer').style.display='none'}}
      else if(bookNum)openBibleBookFromToc(bookNum);
    };
    if(!item.group||bookNum)el.onclick=activate;
    box.appendChild(el);
    if(desktop){const copy=el.cloneNode(true);copy.onclick=el.onclick;desktop.appendChild(copy)}
  });
}
const _contentLangBtn=$('contentLangBtn');if(_contentLangBtn)_contentLangBtn.onclick=()=>showContentLangMenu(_contentLangBtn);$('langBtn').onclick=()=>showLangMenu($('langBtn'));$('readerLangBtn').onclick=()=>showReaderLangMenu($('readerLangBtn'));$('historyBtn').onclick=()=>showHistoryPanel();const _libSearchBtn=$('librarySearchBtn');if(_libSearchBtn)_libSearchBtn.onclick=()=>openReaderSearch({kind:'publications',tab:'library'});$('languagePackInput').onchange=async e=>{try{const f=e.target.files&&e.target.files[0];if(!f)return;const pack=JSON.parse(await f.text());const code=pack.code||pack.lang;const messages=pack.messages||pack.strings;if(!code||!messages||typeof messages!=='object')throw new Error(t('语言包格式不正确'));const meta={name:pack.name,locale:pack.locale,button:pack.button};if(!registerLanguagePack(code,meta,messages))throw new Error(t('语言包格式不正确'));setUiLang(String(code).toLowerCase());say(t('导入语言包'),t('语言包已导入')+': '+code)}catch(err){say(t('语言包导入失败'),err.message||String(err))}finally{e.target.value=''}};$('importToolbar').style.display='none';$('sectionDashboard').style.display='none';try{pronunciationOn=localStorage.getItem('offlineLibraryPronunciation')==='1'}catch(e){}setPinyin(pronunciationOn);$('pronunciationBtn').onclick=()=>setPinyin(!pronunciationOn);
$('importBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{const files=[...(e.target.files||[])];e.target.value='';if(files.length)await openImportDialog(files)};
let importStagingFiles=[];
async function importFiles(files,opts={}){
 const ok=[],bad=[],skipped=[],overwriteNames=opts.overwriteNames||new Set();
 say(t('正在导入'),`0 / ${files.length}`);
 for(let i=0;i<files.length;i++){
  const f=files[i];let b=null;try{$('importBtn').textContent=`${t('正在导入')} ${i+1}/${files.length}…`;try{if($('modal').style.display==='flex')$('modalText').textContent=`${i+1}/${files.length}：${f.name}`}catch(e){}
   b=await parseJwpub(f,msg=>{$('importBtn').textContent=`${i+1}/${files.length}：${msg}`;try{if($('modal').style.display==='flex')$('modalText').textContent=`${i+1}/${files.length}：${msg}`}catch(e){}});
   b.originalFilename=f.name;
   const old=await getBookMeta(b.id)||await reqP(tx('books').get(b.id));
   if(old&&!overwriteNames.has(f.name)&&!confirm(`《${b.displayTitle||b.title}》已经导入。\n是否用这个文件覆盖正文和图片？\n笔记、标签、划线、书签和阅读历史会保留。`)){
     skipped.push(`${b.displayTitle||b.title}（${f.name}）`);continue;
   }
   try{await saveBook(b)}catch(saveErr){
     const msg=String(saveErr&&(saveErr.name||saveErr.message)||saveErr);
     if(/quota/i.test(msg)){await new Promise(r=>setTimeout(r,1800));await saveBook(b)}
     else throw saveErr;
   }
   ok.push(`${b.displayTitle||b.title}（${f.name}）`);logDiag('info','导入成功',{file:f.name,id:b.id,docs:b.docs?.length,assets:b.assets?.length,report:b.importReport});
  }catch(err){console.error(err);bad.push(`${f.name}：${err.message||String(err)}`);logDiag('error','导入失败',{file:f.name,message:err.message||String(err),stack:err&&err.stack})}
  finally{b=null;}
  await new Promise(r=>setTimeout(r,1000));
 }
 $('importBtn').innerHTML='＋ <span>'+t('导入 PUB')+'</span>';
 await renderBooks();
 say(t('批量导入完成'),`${t('成功')} ${ok.length}，${t('失败')} ${bad.length}${skipped.length?`，${t('跳过')} ${skipped.length}`:''}。\n\n${t('成功')}：\n${ok.join('\n')||t('无')}\n\n${t('失败')}：\n${bad.join('\n')||t('无')}${skipped.length?`\n\n${t('跳过')}：\n${skipped.join('\n')}`:''}`);
}
async function openImportDialog(files){
 importStagingFiles=files;
 const metas=await allBooks();
 const existing=new Set(metas.map(b=>b.originalFilename||b.manifestName).filter(Boolean));
 const list=$('importFileList');list.innerHTML='';
 files.forEach((f,i)=>{
  const imported=existing.has(f.name);
  const row=document.createElement('label');row.className='import-file-row';
  const cb=document.createElement('input');cb.type='checkbox';cb.dataset.index=i;cb.checked=!imported;if(imported)cb.dataset.imported='1';
  const body=document.createElement('span');
  const name=document.createElement('span');name.className='import-file-name';name.textContent=f.name;
  const status=document.createElement('span');status.className='import-file-status';status.textContent=imported?(t('已导入')+' · '+t('勾选可覆盖重新导入')):t('未导入 · 勾选后导入');
  body.append(name,status);row.append(cb,body);list.appendChild(row);
 });
 let newCount=0;files.forEach(f=>{if(!existing.has(f.name))newCount++});
 $('importDialogHint').textContent=(newCount?t('未导入的文件默认勾选；'):'')+`${t('已导入')} ${files.length-newCount} ${t('本')}，`+t('默认不勾选；如需覆盖重新解析，请勾选对应文件。');
 $('importDialog').style.display='flex';
}
function closeImportDialog(){ $('importDialog').style.display='none';importStagingFiles=[]; }
$('importDialogClose').onclick=closeImportDialog;
$('importCancel').onclick=closeImportDialog;
$('importSelectNew').onclick=()=>{document.querySelectorAll('#importFileList input:not([data-imported="1"])').forEach(cb=>cb.checked=true)};
$('importConfirm').onclick=async()=>{
 const chosen=[...document.querySelectorAll('#importFileList input:checked')].map(cb=>({file:importStagingFiles[Number(cb.dataset.index)],overwrite:cb.dataset.imported==='1'})).filter(x=>x.file);
 if(!chosen.length){say(t('导入 PUB'),t('请在列表中勾选需要导入的 PUB。'));return}
 const overwrite=chosen.filter(x=>x.overwrite);
 if(overwrite.length&&!confirm(`将覆盖重新导入 ${overwrite.length} 本已存在的出版物。\n正文和图片会被替换；笔记、标签、划线、书签和阅读历史会保留。\n\n是否继续？`))return;
 const overwriteNames=new Set(overwrite.map(x=>x.file.name));
 closeImportDialog();
 await importFiles(chosen.map(x=>x.file),{overwriteNames});
};
document.querySelectorAll('#libraryTabs button').forEach(btn=>btn.onclick=()=>setLibraryTab(btn.dataset.tab));
$('backBtn').onclick=async()=>{
 hideVerseActions();closeLinkPopover();cancelReaderPositionRestore();tabEpoch++;
 if(readerSearchReturn){
   const state=readerSearchReturn;readerSearchReturn=null;
   const tab=state.tab||primarySection||'library';
   readerReturnTarget=null;readerReturnSection=null;readerOriginSection=null;
   clearUrls();bibleMode=false;bibleReturn=null;setBibleToolbar(false);
   $('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid';
   try{delete sectionViews[tab]}catch(e){}
   clearReaderHistory(tab)
   await setPrimaryNav(tab,{skipRestore:true});
   await restoreReaderSearch(state);
   return;
 }
 if(readerReturnTarget&&readerReturnTarget.type==='publication'){
   const target=readerReturnTarget;readerReturnTarget=null;
   clearUrls();bibleMode=false;bibleReturn=null;setBibleToolbar(false);
   const source=await loadBook(target.bookId);
   if(source){
     const docId=target.docId||(source.docs&&source.docs[0]&&source.docs[0].id);
     const ok=await openDocInBook(source,docId,target.anchor?'#'+target.anchor:'',target.tab);
     if(ok){restoreReaderScroll(target.scrollTop);return}
   }
   $('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid';
   setPrimaryNav(target.tab||'library',{skipRestore:true});return;
 }
 if(currentBook&&!bibleMode&&currentIndex>=0){const hd=currentBook.docs[currentIndex];if(hd)await recordHistory(currentBook,hd,$('readerBody').scrollTop)}
 const historySection=readerOriginSection||(bibleMode?'bible':(readerNavSection||primarySection));
 let previousPage=popReaderHistory(historySection);
 while(previousPage){
   readerHistoryRestoring=true;
   let ok=false;try{ok=await openReaderSnapshot(previousPage,historySection)}finally{readerHistoryRestoring=false}
   if(ok){restoreReaderPosition(previousPage,historySection);return}
   previousPage=popReaderHistory(historySection);
 }
 if(bibleMode&&bibleReturn){const r=bibleReturn;bibleMode=false;bibleReturn=null;setBibleToolbar(false);const b=await loadBook(r.bookId);if(b){await openDocInBook(b,r.docId||b.docs[0]?.id);return;}}
 const ret=readerOriginSection||(bibleMode?'bible':(readerNavSection||readerReturnSection));
 readerReturnSection=null;readerOriginSection=null;readerReturnTarget=null;readerSearchReturn=null;
 clearUrls();bibleMode=false;bibleReturn=null;setBibleToolbar(false);$('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid';
 if(ret){
   // Leaving the reader with the back arrow means this tab's current page is
   // the section page again. Do not reopen the article on the next tab tap.
   try{delete sectionViews[ret]}catch(e){}
   clearReaderHistory(ret)
   setPrimaryNav(ret,{skipRestore:true});return;
 }
 renderBooks();
};
let sidebarCollapsed=false,tocHidden=false;
try{sidebarCollapsed=localStorage.getItem('offlineLibrarySidebarCollapsed')==='1'}catch(e){}
try{tocHidden=localStorage.getItem('offlineLibraryTocHidden')==='1'}catch(e){}
function applySidebarState(){
  document.body.classList.toggle('sidebar-collapsed',sidebarCollapsed);
  const btn=$('sidebarToggle');
  if(btn){btn.setAttribute('aria-pressed',sidebarCollapsed?'true':'false');const icon=btn.querySelector('.rail-toggle-icon');if(icon)icon.textContent=sidebarCollapsed?'»':'«';const label=btn.querySelector('.rail-toggle-label');if(label)label.textContent=t(sidebarCollapsed?'展开栏目':'收起栏目');btn.title=t(sidebarCollapsed?'展开栏目':'收起栏目');btn.setAttribute('aria-label',btn.title)}
  const rbtn=$('sideNavBtn');
  if(rbtn){rbtn.setAttribute('aria-pressed',sidebarCollapsed?'true':'false');rbtn.title=t(sidebarCollapsed?'展开栏目':'收起栏目');rbtn.setAttribute('aria-label',rbtn.title)}
}
function toggleSidebarCollapsed(){sidebarCollapsed=!sidebarCollapsed;try{localStorage.setItem('offlineLibrarySidebarCollapsed',sidebarCollapsed?'1':'0')}catch(e){}applySidebarState()}
function applyTocState(){
  document.body.classList.toggle('toc-hidden',tocHidden);
  const b=$('tocBtn');if(b){b.setAttribute('aria-pressed',tocHidden?'true':'false');b.title=t(tocHidden?'显示目录':'隐藏目录');b.setAttribute('aria-label',b.title)}
}
function toggleDesktopToc(){
  if(window.innerWidth<1100){$('drawer').style.display='block';return}
  tocHidden=!tocHidden;try{localStorage.setItem('offlineLibraryTocHidden',tocHidden?'1':'0')}catch(e){}
  applyTocState();
}
applySidebarState();applyTocState();
const _sidebarToggle=$('sidebarToggle');if(_sidebarToggle)_sidebarToggle.onclick=toggleSidebarCollapsed;
const _sideNavBtn=$('sideNavBtn');if(_sideNavBtn)_sideNavBtn.onclick=toggleSidebarCollapsed;
$('tocBtn').onclick=toggleDesktopToc;$('closeDrawer').onclick=()=>$('drawer').style.display='none';$('drawer').onclick=e=>{if(e.target===$('drawer'))$('drawer').style.display='none'};
function bibleChapterMax(bookNum){
  const data=currentBook&&currentBook.bibleData;
  if(data&&data.chapters){let max=0;for(const k of Object.keys(data.chapters)){const p=k.split(':');if(Number(p[0])===Number(bookNum))max=Math.max(max,Number(p[1])||0)}if(max)return max}
  return Number(currentBook&&currentBook.bookChapters&&currentBook.bookChapters[bookNum]||1)||1;
}
function readerNext(){
  if(!currentBook)return;
  if(bibleMode){
    const d=currentBook.docs[currentIndex],m=/^bible-(\d+)-(\d+)$/.exec(String(d&&d.id));if(!m)return;
    let b=Number(m[1]),c=Number(m[2])+1;const max=bibleChapterMax(b);
    if(c>max){b++;c=1;if(b>66)return}
    openBibleChapterReader(currentBook.id,b,c,0,readerOriginSection||primarySection||'bible');return;
  }
  if(currentIndex<currentBook.docs.length-1){pushReaderHistory(readerOriginSection||primarySection);currentIndex++;showDoc();buildToc()}
}
function readerPrev(){
  if(!currentBook)return;
  if(bibleMode){
    const d=currentBook.docs[currentIndex],m=/^bible-(\d+)-(\d+)$/.exec(String(d&&d.id));if(!m)return;
    let b=Number(m[1]),c=Number(m[2])-1;
    if(c<1){b--;if(b<1)return;c=bibleChapterMax(b)}
    openBibleChapterReader(currentBook.id,b,c,0,readerOriginSection||primarySection||'bible');return;
  }
  if(currentIndex>0){pushReaderHistory(readerOriginSection||primarySection);currentIndex--;showDoc();buildToc()}
}
$('prevBtn').onclick=readerPrev;
$('nextBtn').onclick=readerNext;
let swipeStart=null,swipeCooldown=0;
$('readerBody').addEventListener('touchstart',e=>{
  if(e.touches.length!==1){swipeStart=null;return}
  if(e.target.closest&&e.target.closest('a,button,input,textarea,select,label')){swipeStart=null;return}
  const t=e.touches[0];swipeStart={x:t.clientX,y:t.clientY,at:Date.now(),cancelled:false};
},{passive:true});
$('readerBody').addEventListener('touchmove',e=>{
  if(!swipeStart)return;
  if(e.touches.length!==1){swipeStart.cancelled=true;return}
  const t=e.touches[0],dx=t.clientX-swipeStart.x,dy=t.clientY-swipeStart.y;
  if(Math.abs(dy)>45&&Math.abs(dy)>Math.abs(dx))swipeStart.cancelled=true;
},{passive:true});
$('readerBody').addEventListener('touchend',e=>{
  if(!swipeStart||swipeStart.cancelled){swipeStart=null;return}
  const t=e.changedTouches[0],dx=t.clientX-swipeStart.x,dy=t.clientY-swipeStart.y,dt=Date.now()-swipeStart.at;
  swipeStart=null;
  if(Date.now()<swipeCooldown||dt>650||Math.abs(dx)<90||Math.abs(dy)>55||Math.abs(dx)<Math.abs(dy)*1.8)return;
  swipeCooldown=Date.now()+500;
  if(dx<0)readerNext();else readerPrev();
},{passive:true});
$('fontDown').onclick=()=>{fontSize=Math.max(15,fontSize-1);$('article').style.fontSize=fontSize+'px'};
$('fontUp').onclick=()=>{fontSize=Math.min(27,fontSize+1);$('article').style.fontSize=fontSize+'px'};
$('bookmarkBtn').onclick=async()=>{if(bibleMode||currentIndex<0)return;const d=currentBook.docs[currentIndex],id=`${currentBook.id}:${d.id}`,old=await getOne('bookmarks',id);if(old){await reqP(tx('bookmarks','readwrite').delete(id));$('bookmarkBtn').textContent='☆ 书签'}else{await saveOne('bookmarks',{id,bookId:currentBook.id,docId:d.id,title:d.title,createdAt:Date.now()});$('bookmarkBtn').textContent='★ 已书签'}};
$('noteBtn').onclick=async()=>{if(bibleMode||currentIndex<0)return;const d=currentBook.docs[currentIndex],text=prompt('为本节添加个人笔记：');if(text&&text.trim()){await saveOne('notes',{id:`${currentBook.id}:${d.id}:${Date.now()}`,bookId:currentBook.id,docId:d.id,title:d.title,text:text.trim(),createdAt:Date.now()});say('笔记已保存','笔记保存在此设备。请定期导出备份。')}};
