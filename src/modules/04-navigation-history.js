function buildToc(){
  const box=$('tocList'),desktop=$('desktopTocList');box.innerHTML='';if(desktop)desktop.innerHTML='';
  (currentBook.toc||[]).forEach(item=>{
    const el=document.createElement('div');
    el.className='tocitem '+(item.group?'group':'')+(!item.group&&normId(item.docId)===normId(currentBook.docs[currentIndex]?.id)?' active':'');
    el.style.paddingLeft=(10+(item.depth||0)*16)+'px';el.textContent=item.title;
    const bookNum=item.group?bibleTocBookNumber(item.title):0;
    if(bookNum)el.classList.add('toc-book-link');
    const activate=()=>{
      if(!item.group){const ix=currentBook.docs.findIndex(d=>d.id===item.docId);if(ix>=0){pushReaderHistory(historyTab());currentIndex=ix;showDoc();buildToc();$('drawer').style.display='none'}}
      else if(bookNum)openBibleBookFromToc(bookNum);
    };
    if(!item.group||bookNum)el.onclick=activate;
    box.appendChild(el);
    if(desktop){const copy=el.cloneNode(true);copy.onclick=el.onclick;desktop.appendChild(copy)}
  });
}
const _contentLangBtn=$('contentLangBtn');if(_contentLangBtn)_contentLangBtn.onclick=()=>showContentLangMenu(_contentLangBtn);$('langBtn').onclick=()=>showLangMenu($('langBtn'));$('readerLangBtn').onclick=()=>showReaderLangMenu($('readerMoreBtn'));$('historyBtn').onclick=()=>showHistoryPanel();const _libSearchBtn=$('librarySearchBtn');if(_libSearchBtn)_libSearchBtn.onclick=()=>openReaderSearch({kind:'publications',tab:'library'});$('languagePackInput').onchange=async e=>{try{const f=e.target.files&&e.target.files[0];if(!f)return;const pack=JSON.parse(await f.text());const code=pack.code||pack.lang;const messages=pack.messages||pack.strings;if(!code||!messages||typeof messages!=='object')throw new Error(t('语言包格式不正确'));const meta={name:pack.name,locale:pack.locale,button:pack.button};if(!registerLanguagePack(code,meta,messages))throw new Error(t('语言包格式不正确'));setUiLang(String(code).toLowerCase());say(t('导入语言包'),t('语言包已导入')+': '+code)}catch(err){say(t('语言包导入失败'),err.message||String(err))}finally{e.target.value=''}};$('importToolbar').style.display='none';$('sectionDashboard').style.display='none';try{pronunciationOn=localStorage.getItem('offlineLibraryPronunciation')==='1'}catch(e){}setPinyin(pronunciationOn);$('pronunciationBtn').onclick=()=>setPinyin(!pronunciationOn);
$('importBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{const files=[...(e.target.files||[])];e.target.value='';if(files.length)await openImportDialog(files)};
let importStagingFiles=[];
async function importFiles(files,opts={}){
 const ok=[],bad=[],skipped=[],overwriteNames=opts.overwriteNames||new Set();
 say(t('正在导入'),`0 / ${files.length}`);
 for(let i=0;i<files.length;i++){
  const f=files[i];let b=null;try{$('importBtn').textContent=`${t('正在导入')} ${i+1}/${files.length}…`;try{if($('modal').style.display==='flex')$('modalText').textContent=`${i+1}/${files.length}：${f.name}`}catch(e){}
   b=await parseJwpub(f,msg=>{$('importBtn').textContent=`${i+1}/${files.length}：${msg}`;try{if($('modal').style.display==='flex')$('modalText').textContent=`${i+1}/${files.length}：${msg}`}catch(e){}},{captureSource:keepSourceEnabled()});
   b.originalFilename=f.name;
   const old=await getBookMeta(b.id)||await reqP(tx('books').get(b.id));
   if(old&&!overwriteNames.has(f.name)&&!(await askConfirm(t('导入 PUB'),`《${b.displayTitle||b.title}》已经导入。是否用这个文件覆盖正文和图片？笔记、标签、划线、书签和阅读历史会保留。`))){
     skipped.push(`${b.displayTitle||b.title}（${f.name}）`);continue;
   }
   try{await saveBook(b)}catch(saveErr){
     const msg=String(saveErr&&(saveErr.name||saveErr.message)||saveErr);
     if(/quota/i.test(msg)){await new Promise(r=>setTimeout(r,1800));await saveBook(b)}
     else throw saveErr;
   }
   let sourceSaved=false;
   if(b.source&&keepSourceEnabled()){
     try{await saveBookSource(b.id,b.source);sourceSaved=true;logDiag('info','保存原始包',{id:b.id,size:b.source.size})}
     catch(srcErr){logDiag('warn','保存原始包失败',{id:b.id,message:srcErr.message||String(srcErr)})}
   }
   if(sourceFirstEnabled()&&sourceSaved){
     try{const n=await stripBookDocHtml(b.id);logDiag('info','按原始包为主清理正文',{id:b.id,docs:n})}
     catch(stripErr){logDiag('warn','清理解析正文失败',{id:b.id,message:stripErr.message||String(stripErr)})}
     try{const n=await stripBookAuxHtml(b.id);logDiag('info','按原始包为主清理辅助正文',{id:b.id,parts:n})}
     catch(stripErr){logDiag('warn','清理辅助正文失败',{id:b.id,message:stripErr.message||String(stripErr)})}
     try{const n=await stripBibleContent(b.id);if(n)logDiag('info','按原始包为主清理圣经密文',{id:b.id,parts:n})}
     catch(stripErr){logDiag('warn','清理圣经密文失败',{id:b.id,message:stripErr.message||String(stripErr)})}
     try{const n=await stripAssets(b.id);if(n)logDiag('info','按原始包为主清理图片资源',{id:b.id,parts:n})}
     catch(stripErr){logDiag('warn','清理图片资源失败',{id:b.id,message:stripErr.message||String(stripErr)})}
   }
   if(sourceSaved)closeSourceDbs();
   ok.push(`${b.displayTitle||b.title}（${f.name}）`);logDiag('info','导入成功',{file:f.name,id:b.id,docs:b.docs?.length,assets:b.assets?.length,report:b.importReport});
  }catch(err){console.error(err);bad.push(`${f.name}：${err.message||String(err)}`);logDiag('error','导入失败',{file:f.name,message:err.message||String(err),stack:err&&err.stack})}
  finally{b=null;}
  await new Promise(r=>setTimeout(r,1000));
 }
 $('importBtn').innerHTML='<span class="btn-icon">'+svgIcon('plus',18)+'</span><span data-i18n="导入 PUB">'+t('导入 PUB')+'</span>';
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
 $('importDialogHint').textContent=(keepSourceEnabled()?t('导入后会保留原始包以便以后分享，可在设置中关闭。')+' ':'')+(newCount?t('未导入的文件默认勾选；'):'')+`${t('已导入')} ${files.length-newCount} ${t('本')}，`+t('默认不勾选；如需覆盖重新解析，请勾选对应文件。');
 rememberPanelFocus($('importDialog'));$('importDialog').style.display='flex';
 setTimeout(()=>{const cb=$('importFileList')&&$('importFileList').querySelector('input');focusSafely(cb||$('importDialogClose'))},0);
}
function closeImportDialog(){const p=$('importDialog');p.style.display='none';importStagingFiles=[];restorePanelFocus(p)}
$('importDialogClose').onclick=closeImportDialog;
$('importCancel').onclick=closeImportDialog;
$('importSelectNew').onclick=()=>{document.querySelectorAll('#importFileList input:not([data-imported="1"])').forEach(cb=>cb.checked=true)};
$('importConfirm').onclick=async()=>{
 const chosen=[...document.querySelectorAll('#importFileList input:checked')].map(cb=>({file:importStagingFiles[Number(cb.dataset.index)],overwrite:cb.dataset.imported==='1'})).filter(x=>x.file);
 if(!chosen.length){say(t('导入 PUB'),t('请在列表中勾选需要导入的 PUB。'));return}
 const overwrite=chosen.filter(x=>x.overwrite);
 if(overwrite.length&&!(await askConfirm(t('导入 PUB'),`将覆盖重新导入 ${overwrite.length} 本已存在的出版物。正文和图片会被替换；笔记、标签、划线、书签和阅读历史会保留。`)))return;
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
   readerReturnTarget=null;readerReturnSection=null;readerOriginSection=null;readerSessionTab=null;
   clearUrls();bibleMode=false;bibleReturn=null;setBibleToolbar(false);
   $('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid';
   try{delete sectionViews[tab]}catch(e){}
   clearReaderHistory(tab)
   await setPrimaryNav(tab,{skipRestore:true,forceRender:true});
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
   readerSessionTab=null;readerOriginSection=null;
   setPrimaryNav(target.tab||'library',{skipRestore:true,forceRender:true});return;
 }
 if(currentBook&&!bibleMode&&currentIndex>=0){const hd=currentBook.docs[currentIndex];if(hd)await recordHistory(currentBook,hd,$('readerBody').scrollTop)}
 const historySection=readerSessionTab||readerOriginSection||primarySection||(bibleMode?'bible':(readerNavSection||'home'));
 let previousPage=popReaderHistory(historySection);
 while(previousPage){
   readerHistoryRestoring=true;
   let ok=false;try{ok=await openReaderSnapshot(previousPage,historySection)}finally{readerHistoryRestoring=false}
   if(ok){restoreReaderPosition(previousPage,historySection);return}
   previousPage=popReaderHistory(historySection);
 }
 if(bibleMode&&bibleReturn){const r=bibleReturn;bibleMode=false;bibleReturn=null;setBibleToolbar(false);const b=await loadBook(r.bookId);if(b){await openDocInBook(b,r.docId||b.docs[0]?.id);return;}}
 const ret=readerSessionTab||readerOriginSection||primarySection||(bibleMode?'bible':(readerNavSection||readerReturnSection));
 readerReturnSection=null;readerOriginSection=null;readerSessionTab=null;readerReturnTarget=null;readerSearchReturn=null;
 clearUrls();bibleMode=false;bibleReturn=null;setBibleToolbar(false);$('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid';
 if(ret){
   // Leaving the reader with the back arrow means this tab's current page is
   // the section page again. Do not reopen the article on the next tab tap.
   try{delete sectionViews[ret]}catch(e){}
   clearReaderHistory(ret)
   setPrimaryNav(ret,{skipRestore:true,forceRender:true});return;
 }
 renderBooks();
};
let sidebarCollapsed=false,tocHidden=false;
try{sidebarCollapsed=localStorage.getItem('offlineLibrarySidebarCollapsed')==='1'}catch(e){}
try{tocHidden=localStorage.getItem('offlineLibraryTocHidden')==='1'}catch(e){}
function applySidebarState(){
  document.body.classList.toggle('sidebar-collapsed',sidebarCollapsed);
  const btn=$('sidebarToggle');
  if(btn){btn.setAttribute('aria-pressed',sidebarCollapsed?'true':'false');const label=btn.querySelector('.rail-toggle-label');if(label)label.textContent=t(sidebarCollapsed?'展开栏目':'收起栏目');btn.title=t(sidebarCollapsed?'展开栏目':'收起栏目');btn.setAttribute('aria-label',btn.title)}
  const rbtn=$('sideNavBtn');
  if(rbtn){rbtn.setAttribute('aria-pressed',sidebarCollapsed?'true':'false');rbtn.title=t(sidebarCollapsed?'展开栏目':'收起栏目');rbtn.setAttribute('aria-label',rbtn.title)}
}
function toggleSidebarCollapsed(){sidebarCollapsed=!sidebarCollapsed;try{localStorage.setItem('offlineLibrarySidebarCollapsed',sidebarCollapsed?'1':'0')}catch(e){}applySidebarState()}
function applyTocState(){
  document.body.classList.toggle('toc-hidden',tocHidden);
  const b=$('tocBtn');if(b){b.setAttribute('aria-pressed',tocHidden?'true':'false');b.title=t(tocHidden?'显示目录':'隐藏目录');b.setAttribute('aria-label',b.title)}
}
function toggleDesktopToc(){
  if(window.innerWidth<1100){rememberPanelFocus($('drawer'));$('drawer').style.display='block';setTimeout(()=>focusSafely($('closeDrawer')),0);return}
  tocHidden=!tocHidden;try{localStorage.setItem('offlineLibraryTocHidden',tocHidden?'1':'0')}catch(e){}
  applyTocState();
}
applySidebarState();applyTocState();
const _sidebarToggle=$('sidebarToggle');if(_sidebarToggle)_sidebarToggle.onclick=toggleSidebarCollapsed;
const _sideNavBtn=$('sideNavBtn');if(_sideNavBtn)_sideNavBtn.onclick=toggleSidebarCollapsed;
function closeDrawer(){const d=$('drawer');d.style.display='none';restorePanelFocus(d)}
$('tocBtn').onclick=toggleDesktopToc;$('closeDrawer').onclick=closeDrawer;$('drawer').onclick=e=>{if(e.target===$('drawer'))closeDrawer()};
function bibleChapterMax(bookNum){
  const data=currentBook&&currentBook.bibleData;
  if(data&&data.chapters){let max=0;for(const k of Object.keys(data.chapters)){const p=k.split(':');if(Number(p[0])===Number(bookNum))max=Math.max(max,Number(p[1])||0)}if(max)return max}
  return Number(currentBook&&currentBook.bookChapters&&currentBook.bookChapters[bookNum]||1)||1;
}
function syncPager(){
  const p=$('prevBtn'),n=$('nextBtn');if(!p||!n)return;
  if(!currentBook){p.disabled=true;n.disabled=true;return}
  const daily=isDailyTextPublication(currentBook)||categoryPath(currentBook)[0]==='daily';
  const pKey=daily?'前一日':'上一节',nKey=daily?'后一日':'下一节';
  p.setAttribute('data-i18n',pKey);p.textContent=t(pKey);
  n.setAttribute('data-i18n',nKey);n.textContent=t(nKey);
  if(bibleMode){
    const d=currentBook.docs[currentIndex],m=/^bible-(\d+)-(\d+)$/.exec(String(d&&d.id));
    if(!m){p.disabled=true;n.disabled=true;return}
    const b=Number(m[1]),c=Number(m[2]);
    p.disabled=(b<=1&&c<=1);
    n.disabled=(b>=66&&c>=bibleChapterMax(b));
    return;
  }
  p.disabled=currentIndex<=0;
  n.disabled=currentIndex>=currentBook.docs.length-1;
}
function readerNext(){
  if(!currentBook)return;
  if(bibleMode){
    const d=currentBook.docs[currentIndex],m=/^bible-(\d+)-(\d+)$/.exec(String(d&&d.id));if(!m)return;
    let b=Number(m[1]),c=Number(m[2])+1;const max=bibleChapterMax(b);
    if(c>max){b++;c=1;if(b>66)return}
    openBibleChapterReader(currentBook.id,b,c,0,readerSessionTab||readerOriginSection||primarySection||'bible');return;
  }
  if(currentIndex<currentBook.docs.length-1){pushReaderHistory(historyTab());currentIndex++;showDoc();buildToc()}
}
function readerPrev(){
  if(!currentBook)return;
  if(bibleMode){
    const d=currentBook.docs[currentIndex],m=/^bible-(\d+)-(\d+)$/.exec(String(d&&d.id));if(!m)return;
    let b=Number(m[1]),c=Number(m[2])-1;
    if(c<1){b--;if(b<1)return;c=bibleChapterMax(b)}
    openBibleChapterReader(currentBook.id,b,c,0,readerSessionTab||readerOriginSection||primarySection||'bible');return;
  }
  if(currentIndex>0){pushReaderHistory(historyTab());currentIndex--;showDoc();buildToc()}
}
$('prevBtn').onclick=readerPrev;
$('nextBtn').onclick=readerNext;
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey)return;
  if($('reader').style.display!=='block')return;
  if($('modal').style.display==='flex')return;
  if($('confirmModal').style.display==='flex')return;
  if($('noteEditor'))return;
  if($('annotationEditor').classList.contains('show')||$('annotationsPanel').classList.contains('show')||$('historyPanel').classList.contains('show'))return;
  if($('linkPopover').style.display==='block'||$('drawer').style.display==='block')return;
  const panel=$('readerSearchPanel');if(panel&&panel.classList.contains('show'))return;
  const tag=(e.target&&e.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||(e.target&&e.target.isContentEditable))return;
  if(e.key==='ArrowLeft'){e.preventDefault();readerPrev()}
  else if(e.key==='ArrowRight'){e.preventDefault();readerNext()}
});
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
$('bookmarkBtn').onclick=async()=>{if(bibleMode||currentIndex<0)return;const d=currentBook.docs[currentIndex],id=`${currentBook.id}:${d.id}`,old=await getOne('bookmarks',id);if(old){await reqP(tx('bookmarks','readwrite').delete(id));renderBookmarkButton(false)}else{await saveOne('bookmarks',{id,bookId:currentBook.id,docId:d.id,title:d.title,createdAt:Date.now()});renderBookmarkButton(true)}};
$('noteBtn').onclick=()=>{if(bibleMode||currentIndex<0)return;openChapterNotes()};
function closeReaderToolsMenu(){
  const menu=$('readerToolsMenu'),btn=$('readerMoreBtn');
  if(menu)menu.classList.remove('show');
  if(btn)btn.setAttribute('aria-expanded','false');
}
function toggleReaderToolsMenu(){
  const menu=$('readerToolsMenu'),btn=$('readerMoreBtn');
  if(!menu||!btn)return;
  const open=!menu.classList.contains('show');
  if(open){menu.classList.add('show');btn.setAttribute('aria-expanded','true')}
  else closeReaderToolsMenu();
}
$('readerMoreBtn').onclick=e=>{e.stopPropagation();toggleReaderToolsMenu()};
$('readerReimportBtn').onclick=()=>{closeReaderToolsMenu();if(currentBook)updatePublication(currentBook)};
$('readerShareBtn').onclick=()=>{closeReaderToolsMenu();if(currentBook)openShareMenu(currentBook,$('readerMoreBtn'))};
function updateReaderNavLabels(){
  const bible=!!(currentBook&&(currentBook.bibleData||currentBook.hasBible||readerKind(currentBook)==='bible'));
  const prev=$('prevBtnLabel'),next=$('nextBtnLabel');
  if(prev){const key=bible?'上一章':'上一节';if(prev.getAttribute('data-i18n')!==key){prev.setAttribute('data-i18n',key);prev.textContent=t(key)}}
  if(next){const key=bible?'下一章':'下一节';if(next.getAttribute('data-i18n')!==key){next.setAttribute('data-i18n',key);next.textContent=t(key)}}
}
function decorateReaderTools(){
  const map={tocBtn:'list',readerSearchBtn:'search',prevBtn:'swipeLeft',nextBtn:'swipeRight',bookmarkBtn:'starOn',noteBtn:'note',readerLangBtn:'language',pronunciationBtn:'language',fontDown:'minus',fontUp:'plus',readerReimportBtn:'download',readerShareBtn:'upload'};
  for(const [id,icon] of Object.entries(map)){
    const b=$(id);if(!b||b.querySelector('.btn-icon'))continue;
    const s=document.createElement('span');s.className='btn-icon';s.innerHTML=svgIcon(icon,18);
    b.insertBefore(s,b.firstChild);
  }
  updateReaderNavLabels();
}
setTimeout(decorateReaderTools,0);
$('readerToolsMenu').addEventListener('click',e=>{if(e.target.closest&&e.target.closest('#readerLangBtn,#tocBtn,#readerSearchBtn,#noteBtn'))closeReaderToolsMenu()});
document.addEventListener('click',e=>{
  const menu=$('readerToolsMenu');
  if(!menu||!menu.classList.contains('show'))return;
  if(e.target.closest&&e.target.closest('#readerToolsMenu,#readerMoreBtn'))return;
  closeReaderToolsMenu();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeReaderToolsMenu()});
