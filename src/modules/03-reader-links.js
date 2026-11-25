async function openBook(id){
  const epoch=tabEpoch;
  const readerWasOpen=$('reader').style.display==='block';
  if(readerWasOpen&&!readerHistoryRestoring)pushReaderHistory(historyTab());
  readerReturnSection=null;
  readerReturnTarget=null;
  const origin=readerWasOpen?(readerSessionTab||readerOriginSection||primarySection):primarySection;
  readerOriginSection=origin||null;
  readerSessionTab=origin||'home';
  if(currentBook&&currentBook.id!==id)clearUrls();
  try{navScroll[primarySection]=window.scrollY||0}catch(e){}
  closeLinkPopover();showReaderNav(origin||primarySection);bibleMode=false;bibleReturn=null;setBibleToolbar(false);
  currentBook=await loadBook(id);if(!currentBook||epoch!==tabEpoch)return;
  if(currentBook.hasBible)currentBibleId=currentBook.id;
  const meta=await getBookMeta(id);
  if(epoch!==tabEpoch)return;
  if(meta){
    meta.lastOpenedAt=Date.now();meta.usageCount=Number(meta.usageCount||0)+1;
    currentBook.lastOpenedAt=meta.lastOpenedAt;currentBook.usageCount=meta.usageCount;
    // Only the small metadata record is rewritten; the documents and media stay put.
    await saveBookMeta(meta);
    if(epoch!==tabEpoch)return;
  }
  const lastMatch=String(currentBook.lastDocId||'').match(/^bible-(\d+)-(\d+)$/);
  if(lastMatch){await openBibleChapterReader(id,Number(lastMatch[1]),Number(lastMatch[2]),0,primarySection);return;}
  currentIndex=Math.max(0,currentBook.docs.findIndex(d=>normId(d.id)===normId(currentBook.lastDocId)));
  $('home').style.display='none';$('reader').style.display='block';const ok=await showDoc();if(!ok||epoch!==tabEpoch)return;buildToc();
}
async function openDocInBook(book,docId,anchor='',returnSection=null){
  const epoch=tabEpoch;
  const readerWasOpen=$('reader').style.display==='block';
  // A link followed inside the reader belongs to the tab that is currently
  // reading, even if primarySection was changed by an earlier navigation.
  const origin=returnSection||(readerWasOpen?(readerSessionTab||readerOriginSection):null)||primarySection||'study';
  if(readerWasOpen&&!readerHistoryRestoring&&origin===historyTab())pushReaderHistory(origin);
  readerReturnSection=returnSection||null;
  readerReturnTarget=null;
  readerOriginSection=origin;
  readerSessionTab=origin;
  if(book&&currentBook&&currentBook.id!==book.id)clearUrls();
  try{navScroll[primarySection]=window.scrollY||0}catch(e){}
  closeLinkPopover();showReaderNav(returnSection||origin||primarySection);bibleMode=false;bibleReturn=null;setBibleToolbar(false);
  if(!book||book.id===undefined)return false;
  const bibleMatch=String(docId).match(/^bible-(\d+)-(\d+)$/);
  if(bibleMatch){return await openBibleChapterReader(book.id,Number(bibleMatch[1]),Number(bibleMatch[2]),0,origin)===true;}
  if(!Array.isArray(book.docs)){const full=await loadBook(book.id);if(!full||epoch!==tabEpoch)return false;book=full;}
  if(epoch!==tabEpoch)return false;
  currentBook=book;currentIndex=currentBook.docs.findIndex(d=>normId(d.id)===normId(docId));
  if(currentIndex<0)return false;
  $('home').style.display='none';$('reader').style.display='block';const ok=await showDoc(anchor);if(!ok||epoch!==tabEpoch)return false;buildToc();return true;
}
let readerLangCache={key:'',at:0,list:[]};
async function readerSiblingEditions(book){
  if(!book)return [];
  const daily=isDailyTextPublication(book);
  const year=Number(book.year)||0;
  const series=seriesKeyFor(book);
  // Daily-text editions are separate yearly publications. Keep other-language
  // daily texts of the same year available even when their symbol differs.
  const key=series+(daily?`#daily:${year}`:'');
  if(readerLangCache.key===key&&Date.now()-readerLangCache.at<3000)return readerLangCache.list;
  const all=await allBooks(),byLang=new Map();
  for(const b of all){
    if(String(b.id)===String(book.id)||String(b.lang)===String(book.lang))continue;
    const sameSeries=seriesKeyFor(b)===series;
    const sameDaily=daily&&isDailyTextPublication(b)&&year>0&&Number(b.year||0)===year;
    if(!sameSeries&&!sameDaily)continue;
    const k=String(b.lang),prev=byLang.get(k);
    if(!prev||Number(b.importedAt||b.year||0)>Number(prev.importedAt||prev.year||0))byLang.set(k,b);
  }
  const list=[...byLang.values()];
  readerLangCache={key,at:Date.now(),list};
  return list;
}
async function updateReaderLanguageButton(){
  const btn=$('readerLangBtn');if(!btn)return;
  // A Bible chapter belongs to the edition it was opened from; language is
  // fixed there, so the edition switcher is only for ordinary publications.
  if(currentBook&&(currentBook.bibleData||currentBook.hasBible)){btn.style.display='none';return}
  try{const list=await readerSiblingEditions(currentBook);btn.style.display=list.length?'':'none';btn.title=list.length?t('切换语言版本'):t('语言版本')}catch(e){btn.style.display='none'}
}
let readerRestoreToken=0,readerRestoreActive=false,readerActiveView=null,pendingReaderView=null,sectionRestoreSeq=0;
function cancelReaderPositionRestore(){readerRestoreToken++;readerRestoreActive=false}
function readerViewSnapshot(){
  const body=$('readerBody'),doc=currentBook&&currentBook.docs&&currentBook.docs[currentIndex];
  if(!body||!doc)return null;
  let pid=readerVisiblePid(),el=null,anchorOffset=0,blockIndex=-1;
  try{
    const blocks=hlBlocks(hlRoot());
    if(pid)el=$('article').querySelector('[data-pid="'+CSS.escape(String(pid))+'"]');
    if(el)blockIndex=blocks.indexOf(el);
    if(!el){
      // Publications without paragraph ids still need a stable anchor, or a
      // late-loading image can clamp the saved scroll offset to the top.
      const threshold=body.getBoundingClientRect().top+72;
      for(let i=0;i<blocks.length;i++){
        const r=blocks[i].getBoundingClientRect();
        if(r.height<=0)continue;
        if((r.top<=threshold&&r.bottom>threshold)||r.top>threshold){el=blocks[i];blockIndex=i;break}
      }
      pid=el&&el.getAttribute?el.getAttribute('data-pid')||'':'';
    }
    if(el)anchorOffset=el.getBoundingClientRect().top-body.getBoundingClientRect().top;
  }catch(e){}
  return {bookId:String(currentBook.id),docId:String(doc.id),scrollTop:Number(body.scrollTop||0),pid,anchorOffset,blockIndex};
}
const READER_HISTORY_LIMIT=30;
let readerHistoryRestoring=false;
function historyTab(){return readerSessionTab||readerOriginSection||primarySection||'home'}
function pushReaderHistory(tab){
  tab=tab||historyTab();
  const snap=readerViewSnapshot();if(!snap||!tab)return;
  const list=sectionPageHistory[tab]||(sectionPageHistory[tab]=[]);
  const last=list[list.length-1];
  if(last&&String(last.bookId)===String(snap.bookId)&&String(last.docId)===String(snap.docId)&&Math.abs(Number(last.scrollTop||0)-Number(snap.scrollTop||0))<2)return;
  list.push({...snap,tab});
  if(list.length>READER_HISTORY_LIMIT)list.shift();
  scheduleReaderCacheSave();
}
function popReaderHistory(tab){
  const key=tab||historyTab();
  const list=sectionPageHistory[key];
  // Never let an entry recorded for another tab open that tab's article here.
  while(list&&list.length){
    const item=list.pop();
    if(item&&item.tab===key){scheduleReaderCacheSave();return item}
  }
  return null;
}
function clearReaderHistory(tab){
  if(tab&&sectionPageHistory[tab]){sectionPageHistory[tab]=[];scheduleReaderCacheSave()}
}
function readerSnapshotSame(a,b){return a&&b&&String(a.bookId)===String(b.bookId)&&String(a.docId)===String(b.docId)}
async function openReaderSnapshot(view,tab){
  if(!view||!view.bookId||!view.docId)return false;
  const m=String(view.docId).match(/^bible-(\d+)-(\d+)$/);
  if(m)return await openBibleChapterReader(view.bookId,Number(m[1]),Number(m[2]),0,tab)===true;
  const book=(currentBook&&String(currentBook.id)===String(view.bookId))?currentBook:await loadBook(view.bookId);if(!book)return false;
  return await openDocInBook(book,view.docId,'',tab)===true;
}
function storeReaderView(tab,useTarget){
  if(!tab)return;
  const doc=currentBook&&currentBook.docs&&currentBook.docs[currentIndex];
  let snap=null;
  if(useTarget&&readerRestoreActive&&readerActiveView&&doc&&String(readerActiveView.bookId)===String(currentBook.id)&&String(readerActiveView.docId)===String(doc.id))snap={...readerActiveView};
  if(!snap)snap=readerViewSnapshot();
  if(snap)sectionViews[tab]=snap;
  scheduleReaderCacheSave();
}
function restoreReaderPosition(view,tab){
  if(!view)return;
  const token=++readerRestoreToken,body=$('readerBody');
  if(!body)return;
  readerRestoreActive=true;readerActiveView={...view};
  const target=Math.max(0,Number(view.scrollTop||0));
  const apply=()=>{
    if(token!==readerRestoreToken)return;
    try{
      let usedAnchor=false;
      let el=null;
      if(view.pid){el=$('article').querySelector('[data-pid="'+CSS.escape(String(view.pid))+'"]')}
      // Fall back to the block position when ids change or the publication
      // has no usable paragraph id; this is still much better than top of page.
      if(!el&&Number.isFinite(Number(view.blockIndex))&&Number(view.blockIndex)>=0)el=hlBlocks(hlRoot())[Number(view.blockIndex)]||null;
      if(el){
        const bodyTop=body.getBoundingClientRect().top;
        const delta=el.getBoundingClientRect().top-bodyTop-Number(view.anchorOffset||0);
        if(Math.abs(delta)>1)body.scrollTop=Math.max(0,body.scrollTop+delta);
        usedAnchor=true;
      }
      if(!usedAnchor)body.scrollTop=target;
      else if(Math.abs(body.scrollTop-target)<2)body.scrollTop=target;
      if(tab&&sectionViews[tab]&&String(sectionViews[tab].docId)===String(view.docId)){sectionViews[tab].scrollTop=Number(body.scrollTop||0);scheduleReaderCacheSave()}
    }catch(e){}
  };
  apply();requestAnimationFrame(apply);
  // Late images/fonts can still change the article height. Keep re-applying
  // the anchor until the user touches or scrolls, which cancels the token.
  [80,240,500,900,1500,2500,3500,4500].forEach(ms=>setTimeout(apply,ms));
  setTimeout(()=>{if(token===readerRestoreToken)readerRestoreActive=false},3600);
  try{$('article').querySelectorAll('img').forEach(img=>{if(!img.complete)img.addEventListener('load',()=>{if(token===readerRestoreToken)apply()},{once:true})})}catch(e){}
}
function readerVisiblePid(){
  try{
    const body=$('readerBody'),article=$('article');
    if(!body||!article)return '';
    const threshold=body.getBoundingClientRect().top+72;
    const hits=[];let next=null,nextTop=Infinity;
    for(const el of article.querySelectorAll('[data-pid]')){
      const pid=el.getAttribute('data-pid');if(!pid)continue;
      const r=el.getBoundingClientRect();if(r.height<=0)continue;
      if(r.top<=threshold&&r.bottom>threshold)hits.push({el,r});
      else if(r.top>threshold&&r.top<nextTop){next=el;nextTop=r.top}
    }
    // Nested wrappers all "contain" the reading line. Pick the smallest one so
    // the saved anchor is the actual paragraph, not an outer article wrapper.
    if(hits.length){
      hits.sort((a,b)=>(a.r.height-b.r.height)||(b.r.top-a.r.top));
      return hits[0].el.getAttribute('data-pid')||'';
    }
    if(next)return next.getAttribute('data-pid')||'';
  }catch(e){}
  return '';
}
function closeReaderLangMenu(){const m=document.getElementById('readerLangMenu');if(m)m.remove()}
async function showReaderLangMenu(anchor){
  closeReaderLangMenu();
  const list=await readerSiblingEditions(currentBook);
  if(!list.length){say(t('语言版本'),t('没有可用的其他语言版本'));return}
  const menu=document.createElement('div');menu.id='readerLangMenu';menu.className='book-action-menu';
  const head=document.createElement('div');head.className='book-action-title';head.textContent=contentLangName(currentBook&&currentBook.lang);menu.appendChild(head);
  list.slice().sort((a,b)=>Number(a.lang)-Number(b.lang)).forEach(b=>{
    const btn=document.createElement('button');btn.className='book-action';btn.textContent=contentLangName(b.lang);
    btn.onclick=e=>{e.stopPropagation();switchReaderLanguage(b)};menu.appendChild(btn);
  });
  const rect=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(rect.right-200,window.innerWidth-220))+'px';menu.style.top=(rect.bottom+6)+'px';
  document.body.appendChild(menu);
}
async function switchReaderLanguage(sibling){
  if(!currentBook||!sibling)return;
  const doc=currentBook.docs[currentIndex],pid=readerVisiblePid();
  const bibleMatch=String(doc&&doc.id||'').match(/^bible-(\d+)-(\d+)$/);
  if(bibleMatch){closeReaderLangMenu();await openBibleChapterReader(sibling.id,Number(bibleMatch[1]),Number(bibleMatch[2]),0,readerSessionTab||readerOriginSection||primarySection||'bible');return}
  const full=await loadBook(sibling.id);
  if(!full){say(t('语言版本'),t('找不到该出版物的数据。'));return}
  let target=null;
  // Daily-text documents are keyed by date, not by MEPS id (which is 0).
  if(doc&&(doc.datedText||doc.dateKey)){
    target=full.docs.find(d=>d.datedText&&String(d.dateKey)===String(doc.dateKey));
    if(!target&&doc.dateOffset!==undefined)target=full.docs.find(d=>d.datedText&&Number(d.dateOffset)===Number(doc.dateOffset));
  }
  if(!target&&doc&&doc.mepsId)target=full.docs.find(d=>String(d.mepsId)===String(doc.mepsId));
  if(!target&&doc)target=full.docs.find(d=>normId(d.title)===normId(doc.title));
  if(!target)target=full.docs[Math.min(Math.max(0,currentIndex),full.docs.length-1)];
  if(!target){say(t('语言版本'),t('找不到对应的文章。'));return}
  if(categoryPath(currentBook)[0]==='daily'||categoryPath(full)[0]==='daily')rememberDailyBook(full.id);
  closeReaderLangMenu();
  await openDocInBook(full,target.id,pid||'',readerReturnSection);
}
async function restoreSectionView(tab){
  const epoch=tabEpoch;
  const saved=sectionViews[tab];if(!saved||!saved.bookId||!saved.docId)return false;
  const v={...saved};
  const m=String(v.docId).match(/^bible-(\d+)-(\d+)$/);
  let ok=false;
  const seq=++sectionRestoreSeq;
  // Restore from a copy: sectionViews[tab] is also updated by the scroll
  // listener while the new article is being laid out.
  pendingReaderView={...v};
  // Restoring a tab is not navigation inside the reader. The previous tab's
  // article is still on screen while this one loads, so it must not be pushed
  // into the target tab's back history or be mistaken for the source of a
  // Bible jump. Otherwise the back arrow of this tab would reopen the article
  // that was being read in the other tab.
  readerSessionTab=tab;readerOriginSection=tab;
  readerHistoryRestoring=true;
  try{
    if(m){ok=await openBibleChapterReader(v.bookId,Number(m[1]),Number(m[2]),0,tab)===true;}
    else{const book=(currentBook&&String(currentBook.id)===String(v.bookId))?currentBook:await loadBook(v.bookId);if(!book||epoch!==tabEpoch)return false;ok=await openDocInBook(book,v.docId,'',tab);}
  }finally{
    // A newer tab restore owns these globals now; do not clear them under it.
    if(seq===sectionRestoreSeq){pendingReaderView=null;readerHistoryRestoring=false}
  }
  if(!ok||epoch!==tabEpoch||seq!==sectionRestoreSeq)return false;
  restoreReaderPosition(v,tab);
  return true;
}
function clearUrls(bookId){
  for(const [k,u] of [...assetUrlCache]){
    if(bookId!==undefined&&!k.startsWith(String(bookId)+'::'))continue;
    try{URL.revokeObjectURL(u)}catch(e){}
    assetUrlCache.delete(k);
  }
  currentObjectUrls=[];
}
async function docAssetMap(book,html){
  const bookId=book&&book.id;
  if(!bookId)return {};
  let assets;
  if(Array.isArray(book.assets)&&book.assets.length)assets=book.assets;
  else assets=await loadAssetsForHtml(bookId,book.gen,html);
  const map={},counts={};
  for(const a of assets){
    const name=String(a.name||'').replace(/\\/g,'/').toLowerCase();
    if(!name)continue;
    const base=name.split('/').pop();
    const ck=String(bookId)+'::'+String(a.name);
    let url=assetUrlCache.get(ck);
    if(!url){try{url=URL.createObjectURL(a.blob);assetUrlCache.set(ck,url)}catch(e){continue}}
    map[name]=url;counts[base]=(counts[base]||0)+1;map['$base:'+base]=url;
  }
  for(const base of Object.keys(counts))if(counts[base]>1)delete map['$base:'+base];
  return map;
}
function linkPanelDocked(){return window.innerWidth>=1100}
function linkPanelTitleEl(){return linkPanelDocked()?$('readerSidePanelTitle'):$('linkPopoverTitle')}
function linkPanelBodyEl(){return linkPanelDocked()?$('readerSidePanelBody'):$('linkPopoverBody')}
function linkPanelOpen(){return linkPanelDocked()?document.body.classList.contains('reader-panel-open'):($('linkPopover')&&$('linkPopover').style.display==='block')}
function closeLinkPopover(restore=true){
  document.body.classList.remove('reader-panel-open');
  const pop=$('linkPopover');if(pop){pop.style.display='none';if(restore)restorePanelFocus(pop)}
  const popBody=$('linkPopoverBody');if(popBody)popBody.innerHTML='';
  const sideBody=$('readerSidePanelBody');if(sideBody)sideBody.innerHTML='';
}
function positionLinkPopover(anchorEl){
  const panel=$('linkPopover'),w=panel.offsetWidth,h=panel.offsetHeight;
  const vw=window.innerWidth,vh=window.innerHeight;
  const rect=anchorEl?.getBoundingClientRect?.();
  let left=rect?rect.left:Math.max(12,(vw-w)/2);
  left=Math.max(10,Math.min(left,vw-w-10));
  let top=rect?rect.bottom+8:Math.max(70,(vh-h)/2);
  if(rect&&top+h>vh-12)top=rect.top-h-8;
  top=Math.max(62,Math.min(top,vh-h-10));
  panel.style.left=left+'px';panel.style.top=top+'px';
}
function setLinkPanelTitle(title,onClick){
  const el=linkPanelTitleEl();if(!el)return;
  el.textContent='';
  el.classList.toggle('has-link-title',!!onClick);
  if(onClick){
    const btn=document.createElement('button');btn.type='button';btn.className='link-panel-title-link';
    btn.textContent=title||t('链接内容');
    btn.onclick=async e=>{e.preventDefault();e.stopPropagation();if(btn.disabled)return;btn.disabled=true;try{await onClick()}finally{btn.disabled=false}};
    el.appendChild(btn);
  }else el.textContent=title||t('链接内容');
}
async function showLinkPopover(title,rawHtml,book,anchorEl,anchor='',opts={}){
  hideVerseActions();
  closeLinkPopover(false);
  const docked=linkPanelDocked();
  const map=await docAssetMap(book,String(rawHtml||''));
  const clean=cleanHtml(String(rawHtml||''),map);
  setLinkPanelTitle(title,opts&&opts.onTitleClick);
  const body=linkPanelBodyEl();if(!body)return;
  body.innerHTML='';body.scrollTop=0;
  if(clean.styles){const style=document.createElement('style');style.textContent=clean.styles;body.appendChild(style);}
  const content=document.createElement('div');content.className='publication-content publication-content-'+readerKind(book);content.innerHTML=clean.body||('<p>'+t('没有可显示的内容。')+'</p>');body.appendChild(content);
  applyFootnoteMarkers(content);
  applyPinyinDom(body);
  if(docked)document.body.classList.add('reader-panel-open');
  else {rememberPanelFocus($('linkPopover'));$('linkPopover').style.display='block';setTimeout(()=>focusSafely($('linkPopoverClose')),0)}
  requestAnimationFrame(()=>{
    if(!docked)positionLinkPopover(anchorEl);
    if(anchor){
      const value=decodeURIComponent(String(anchor).replace(/^#/,''));
      let target=body.querySelector('#'+CSS.escape(value));
      if(!target&&/^p?\\d+$/i.test(value)){
        const pid=value.replace(/^p/i,'');
        target=body.querySelector('[data-pid="'+pid+'"],[data-pnum="'+pid+'"],[id="p'+pid+'"],#par'+pid);
      }
      if(target)target.scrollIntoView({block:'start'});
    }
  });
}
function findAnchorTarget(anchor){
  if(!anchor)return null;
  const value=decodeURIComponent(String(anchor).replace(/^#/,''));
  let el=$('article').querySelector('#'+CSS.escape(value));
  if(!el&&/^p?\d+$/i.test(value)){
    const pid=value.replace(/^p/i,'');
    el=$('article').querySelector('[data-pid="'+pid+'"],[data-pnum="'+pid+'"],[id="p'+pid+'"],#par'+pid);
  }
  return el;
}
function readerKind(book){const p=categoryPath(book);if(book?.bibleData||book?.hasBible||p[0]==='bible')return 'bible';if(p[0]==='magazines')return 'magazine';if(p[0]==='meetings')return 'meeting';if(p[0]==='daily')return 'daily';if(p[0]==='brochures')return 'brochure';if(p[0]==='books')return 'book';return 'general'}
function markerTextNode(el){
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
  let node=null;
  while((node=walker.nextNode())){
    if(String(node.nodeValue||'').trim())return node;
  }
  return null;
}
function applyBibleCrossRefMarkers(root,book){
  if(!root||!book||!book.bibleData)return;
  const data=book.bibleData;
  root.querySelectorAll('.m[data-mid]').forEach(el=>{
    el.querySelectorAll('.tt').forEach(n=>n.remove());el.removeAttribute('style');
    const v=el.closest('.v');const ctx=v?verseContext(v):null;
    const bookNum=ctx?ctx.bookNum:0,mid=String(el.getAttribute('data-mid')||'');
    if(bookNum&&((data.blockRefs||{})[`${bookNum}:${mid}`]||[]).length){el.classList.add('xref-marker');el.title=t('相关经文')}
  });
  root.querySelectorAll('.v').forEach(v=>{const ctx=verseContext(v);if(ctx&&((data.crossRefs||{})[ctx.key]||[]).length)v.querySelectorAll('.cl').forEach(el=>el.classList.add('verse-xref'))});
}
function applyFootnoteMarkers(root){
  if(!root)return;
  // Footnotes in JWPUB are lettered a/b/c. Use only monochrome text symbols:
  // glyphs such as U+2733 or U+271D can be rendered as coloured emoji on iOS
  // and Android, which is why some markers looked like green/purple boxes.
  // Numbering restarts for each verse so the symbols follow the inline order.
  const symbols=['*','†','‡','§','‖','¶','#'];
  const groups=new Map();
  root.querySelectorAll('.fn[data-fnid]').forEach(el=>{
    el.querySelectorAll('.tt').forEach(n=>n.remove());el.removeAttribute('style');
    const groupEl=el.closest('.v,.bible-verse')||root;
    const groupKey=groupEl.id||groupEl.getAttribute&&groupEl.getAttribute('data-bible-verse')||'root';
    let group=groups.get(groupKey);
    if(!group){group={byId:new Map(),next:0};groups.set(groupKey,group)}
    const id=String(el.getAttribute('data-fnid')||'');
    let sym=group.byId.get(id);
    if(!sym){sym=symbols[group.next%symbols.length];group.next++;group.byId.set(id,sym)}
    const node=markerTextNode(el);
    if(node)node.nodeValue=node.nodeValue.replace(/^(\s*)\S/, (m,ws)=>ws+sym);
    else el.insertBefore(document.createTextNode(sym),el.firstChild);
    el.dataset.fnSymbol=sym;el.title=t('脚注');
  });
}
function footnoteTarget(root,id){
  if(!root)return null;
  let nodes=[];try{nodes=[...root.querySelectorAll('[data-fnid="'+CSS.escape(String(id))+'"]')]}catch(e){}
  return nodes.find(el=>!el.classList.contains('fn'))||null;
}
function footnoteBodyHtml(target){
  if(!target)return '';
  const clone=target.cloneNode(true);
  clone.querySelectorAll('.fn-symbol,.tt').forEach(n=>n.remove());
  return clone.innerHTML;
}
async function showFootnote(el){
  const id=String(el&&el.getAttribute('data-fnid')||'');
  if(!id)return;
  const scope=el.closest('.publication-content')||$('article');
  let target=footnoteTarget(scope,id);
  // A footnote marker inside a link preview may point back to the article's
  // footnote block outside the popover.
  if(!target&&scope!==$('article'))target=footnoteTarget($('article'),id);
  if(!target){say(t('脚注'),t('没有找到对应的脚注正文。'));return}
  await showLinkPopover(t('脚注'),footnoteBodyHtml(target),currentBook,el);
}
async function showDoc(anchor=''){
  const epoch=tabEpoch;
  hideVerseActions();
  bibleMode=false;setBibleToolbar(false);
  const d=currentBook.docs[currentIndex];if(!d)return;
  // Take the pending restore snapshot before touching the DOM. Replacing the
  // article clamps readerBody.scrollTop to the new content height, and the
  // scroll listener would write that value back into the same object we are
  // about to restore from, losing the paragraph the user was reading.
  const pendingView=pendingReaderView?{...pendingReaderView}:null;
  if(pendingView){readerRestoreActive=true;readerActiveView={...pendingView}}
  $('readerTitle').textContent=d.title;$('article').innerHTML='';
  const kind=readerKind(currentBook);$('article').className='reader-kind-'+kind;$('article').dataset.publicationKind=kind;
  document.body.classList.toggle('daily-reader',kind==='daily');
  const bottomTools=document.querySelector('.bottom-tools');if(bottomTools)bottomTools.style.display=kind==='daily'?'none':'flex';
  const map=await docAssetMap(currentBook,d.html);if(epoch!==tabEpoch)return false;
  const clean=cleanHtml(d.html,map),style=document.createElement('style');style.textContent=clean.styles||'';$('article').appendChild(style);
  const content=document.createElement('div');content.className='publication-content publication-content-'+kind;content.innerHTML=clean.body;
  const hasHeading=!!content.querySelector('h1,h2,.documentTitle,.title');
  if(!hasHeading&&!d.bibleChapter&&(d.titleRich||d.title)){const head=document.createElement('header');head.className='reader-generated-heading';const h=document.createElement('h1');h.innerHTML=d.titleRich||safeText(d.title);head.appendChild(h);if(d.subtitleRich||d.subtitle){const sub=document.createElement('p');sub.className='reader-generated-subtitle';sub.innerHTML=d.subtitleRich||safeText(d.subtitle);head.appendChild(sub)}content.insertBefore(head,content.firstChild)}
  if(epoch!==tabEpoch)return false;
  $('article').appendChild(content);
  applyBibleCrossRefMarkers(content,currentBook);
  applyFootnoteMarkers(content);
  applyPinyinDom($('article'));
  updateReaderLanguageButton();
  await applyHighlightsForDoc(currentBook.id,d.id);
  await applyVerseNotesForDoc(currentBook.id,d.id);
  await applyBlockNotesForDoc(currentBook.id,d.id);
  await applyCrossLanguageNotes(currentBook,d);
  await setupAnswerFields(currentBook.id,d.id);
  if(epoch!==tabEpoch)return false;
  const saved=pendingView?null:await getOne('history',`${currentBook.id}:${d.id}`);
  const restore=pendingView?Number(pendingView.scrollTop||0):Number(saved&&saved.scrollTop||0);
  const historyRestoreToken=++readerRestoreToken;
  if(pendingView){
    $('readerBody').scrollTop=Math.max(0,restore);
  }else if(restore){
    readerRestoreActive=true;readerActiveView={bookId:String(currentBook.id),docId:String(d.id),scrollTop:restore,pid:'',anchorOffset:0};
    const applyHistoryScroll=()=>{if(historyRestoreToken!==readerRestoreToken)return;try{$('readerBody').scrollTop=restore}catch(e){}};
    applyHistoryScroll();requestAnimationFrame(applyHistoryScroll);setTimeout(applyHistoryScroll,300);
    setTimeout(()=>{if(historyRestoreToken===readerRestoreToken)readerRestoreActive=false},420);
  }
  currentBook.lastDocId=d.id;
  // lastDocId lives in the small metadata record; never rewrite the whole book.
  await touchedBookMeta(currentBook,{lastDocId:d.id});
  if(!pendingView)await recordHistory(currentBook,d,restore);
  const viewTab=readerSessionTab||readerOriginSection||readerNavSection||primarySection;
  if(viewTab){
    const oldView=sectionViews[viewTab];
    if(pendingView)sectionViews[viewTab]={...pendingView};
    else if(oldView&&String(oldView.bookId)===String(currentBook.id)&&String(oldView.docId)===String(d.id))sectionViews[viewTab]=oldView;
    else sectionViews[viewTab]={bookId:String(currentBook.id),docId:String(d.id),scrollTop:restore,pid:'',anchorOffset:0};
    scheduleReaderCacheSave();
  }
  renderBookmarkButton(!!await getOne('bookmarks',`${currentBook.id}:${d.id}`));
  try{syncPager()}catch(e){}
  if(anchor){const target=findAnchorTarget(anchor);if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'start'}));}
  return true;
}
function publicationPars(value){
  const m=String(value||'').match(/^(\d+)(?::\d+)?(?:-(\d+)(?::\d+)?)?/);
  return m?{paragraph:Number(m[1]),lastParagraph:m[2]?Number(m[2]):Number(m[1])}:{paragraph:0,lastParagraph:0};
}
function parsePublicationLink(href){
  // jwpubkit's documented format: jwpub://p/S:2013043/22-22 (or without paragraph range).
  // Some publications list several candidate addresses for one reference:
  // jwpub://p/S:1102014703/$p/S:1102014704/ (program/song alternatives).
  const m=String(href).match(/^jwpub:\/\/p\/([A-Za-z0-9_-]+):(\d+)(?:\/([^?#]*))?(?:#(.*))?$/i);
  if(!m)return null;
  const parts=(m[3]||'').split(/\$p\//i),anchor=m[4]||'';
  const first={prefix:m[1],symbol:m[1],docId:Number(m[2]),...publicationPars(parts[0]),anchor};
  const targets=[first];
  for(let i=1;i<parts.length;i++){
    const alt=parts[i].match(/^([A-Za-z0-9_-]+):(\d+)(?:\/([^?#]*))?/);
    if(alt)targets.push({prefix:alt[1],symbol:alt[1],docId:Number(alt[2]),...publicationPars(alt[3]),anchor});
  }
  return {...first,targets};
}
function parseBibleLink(href){
  // Same address grammar as jwpubkit/internal/bible.ParseLink.
  const m=String(href).match(/^jwpub:\/\/b\/([A-Za-z0-9]+)\/(\d+):(\d+):(\d+)(?:-(\d+):(\d+):(\d+))?/i);
  if(!m)return null;
  const book=Number(m[2]),chapter=Number(m[3]),verse=Number(m[4]);
  const endBook=m[5]?Number(m[5]):book;
  if(book<1||book>66||endBook!==book)return null;
  return {version:m[1],book,chapter,verse,endChapter:m[6]?Number(m[6]):chapter,endVerse:m[7]?Number(m[7]):verse};
}
function resolveBibleVerseId(data,book,chapter,verse,scanTo){
  const key=`${book}:${chapter}:${verse}`;
  if(data.refs&&data.refs[key]!==undefined)return Number(data.refs[key]);
  if(scanTo!==undefined&&scanTo!==verse){
    const step=scanTo>verse?1:-1;
    for(let v=verse+step;step>0?v<=scanTo:v>=scanTo;v+=step){
      const id=data.refs?.[`${book}:${chapter}:${v}`];
      if(id!==undefined)return Number(id)-(v-verse);
    }
  }
  const b=data.chapters?.[`${book}:${chapter}`];
  if(b){const id=Number(b.firstNumberedVerseId)+verse-1;if(id<=Number(b.lastVerseId))return id;}
  return undefined;
}
function chineseBibleBookName(data,book){
  const fromDoc=data.bookNames?.[book];if(fromDoc)return fromDoc;
  const names=['','创世记','出埃及记','利未记','民数记','申命记','约书亚记','士师记','路得记','撒母耳记上','撒母耳记下','列王纪上','列王纪下','历代志上','历代志下','以斯拉记','尼希米记','以斯帖记','约伯记','诗篇','箴言','传道书','雅歌','以赛亚书','耶利米书','耶利米哀歌','以西结书','但以理书','何西阿书','约珥书','阿摩司书','俄巴底亚书','约拿书','弥迦书','那鸿书','哈巴谷书','西番雅书','哈该书','撒迦利亚书','玛拉基书','马太福音','马可福音','路加福音','约翰福音','使徒行传','罗马书','哥林多前书','哥林多后书','加拉太书','以弗所书','腓立比书','歌罗西书','帖撒罗尼迦前书','帖撒罗尼迦后书','提摩太前书','提摩太后书','提多书','腓利门书','希伯来书','雅各书','彼得前书','彼得后书','约翰一书','约翰二书','约翰三书','犹大书','启示录'];
  return names[book]||`第${book}卷`;
}
function setBibleToolbar(on){
  try{$('reader').classList.toggle('bible-mode',!!on)}catch(e){}
  $('tocBtn').style.display=on?'none':'';
  $('prevBtn').style.display=on?'none':'';
  $('nextBtn').style.display=on?'none':'';
  $('bookmarkBtn').style.display=on?'none':'';
  $('noteBtn').style.display=on?'none':'';
  const tools=$('prevBtn')&&$('prevBtn').closest('.bottom-tools');if(tools)tools.style.display=on?'none':'flex';
}
async function openBibleChapterReader(bookId,bookNum,chapter,verse=0,origin=null){
  const epoch=tabEpoch;
  const readerWasOpen=$('reader').style.display==='block';
  const sourceBook=currentBook;
  const sourceDoc=sourceBook&&sourceBook.docs&&sourceBook.docs[currentIndex];
  // A scripture link inside a normal publication is a jump, not a move into
  // the Bible section. Remember the exact source publication/paragraph so the
  // back arrow can return to the article the reader came from.
  const externalJump=readerWasOpen&&!readerHistoryRestoring&&sourceBook&&!sourceBook.bibleData&&!sourceBook.hasBible;
  if(readerWasOpen&&!readerHistoryRestoring&&!externalJump&&(origin||primarySection||readerOriginSection)===historyTab())pushReaderHistory(historyTab());
  if(externalJump){
    readerReturnTarget={type:'publication',tab:readerSessionTab||readerOriginSection||primarySection||'library',bookId:String(sourceBook.id),docId:String(sourceDoc&&sourceDoc.id||''),mepsDocId:String(sourceDoc&&sourceDoc.mepsId||''),anchor:readerVisiblePid(),scrollTop:Number($('readerBody').scrollTop||0)};
  }else if(!readerWasOpen||!readerReturnTarget){
    readerReturnTarget=null;
  }
  const full=(currentBook&&String(currentBook.id)===String(bookId)&&currentBook.bibleData)?currentBook:await loadBook(bookId);
  if(epoch!==tabEpoch)return false;
  if(!full)return false;
  const data=full.bibleData||{};
  let html='';
  const idx=data.chapterIndex?.[`${bookNum}:${chapter}`];
  const row=idx!==undefined?data.chapterRows?.[idx]:null;
  if(row&&row.content){
    try{html=await decryptContent(bytes(row.content),{key:bytesHex(data.keyHex),iv:bytesHex(data.ivHex)});}
    catch(e){logDiag('warn','圣经章节解密失败',{bookId,bookNum,chapter,message:e&&e.message||String(e)});}
  }
  if(!html){
    const ch=data.chapters?.[`${bookNum}:${chapter}`];
    if(ch){
      const first=Number(ch.firstNumberedVerseId),last=Number(ch.lastVerseId);
      for(let id=first;id<=last;id++){
        const ri=data.verseIndex?.[id],vr=ri===undefined?null:data.verseRows?.[ri];
        if(!vr)continue;
        try{
          const text=await decryptContent(bytes(vr.content),{key:bytesHex(data.keyHex),iv:bytesHex(data.ivHex)});
          const label=String(vr.label||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
          html+=`<div class="bible-verse" data-bible-verse="${id}"><sup>${safeText(label)}</sup> ${text}</div>`;
        }catch(e){}
      }
    }
  }
  if(!html){if(epoch===tabEpoch)say('无法显示章节',`没有找到${chineseBibleBookName(data,bookNum)}第${chapter}章的正文。`);return false;}
  if(epoch!==tabEpoch)return false;
  currentBibleId=bookId;
  const title=`${chineseBibleBookName(data,bookNum)} ${chapter}`;
  const docId=`bible-${bookNum}-${chapter}`;
  const synthetic={id:docId,mepsId:0,title,html,bibleChapter:true,chapterNumber:chapter};
  const ix=full.docs.findIndex(d=>String(d.id)===docId);
  if(ix>=0)full.docs[ix]=synthetic;else full.docs.push(synthetic);
  currentBook=full;currentIndex=full.docs.findIndex(d=>String(d.id)===docId);
  const section=(readerWasOpen?(readerSessionTab||readerOriginSection):null)||origin||primarySection||'bible';
  readerOriginSection=section;
  readerSessionTab=section;
  readerReturnSection=section;
  bibleMode=false;setBibleToolbar(false);
  try{navScroll[primarySection]=window.scrollY||0}catch(e){}
  $('home').style.display='none';$('reader').style.display='block';showReaderNav(section);
  const ok=await showDoc();if(!ok||epoch!==tabEpoch)return false;buildToc();
  if(verse){try{const target=$('article').querySelector(`[id^="v${bookNum}-${chapter}-${verse}-"]`);if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'center'}))}catch(e){}}
  bibleMode=true;setBibleToolbar(true);
  return true;
}
async function bibleRangeHtml(bibleBook,range){
  if(!bibleBook.bibleData){const aux=await loadBookAuxOnly(bibleBook.id);if(aux)bibleBook={...bibleBook,...aux};}
  const data=bibleBook.bibleData;
  if(!data)return {html:'',data:null,reason:'no-data'};
  const scan=range.chapter===range.endChapter?range.endVerse:undefined;
  const first=resolveBibleVerseId(data,range.book,range.chapter,range.verse,scan);
  const last=resolveBibleVerseId(data,range.book,range.endChapter,range.endVerse);
  if(first===undefined||last===undefined||last<first)return {html:'',data,reason:'no-index'};
  if(last-first+1>120)return {html:'',data,reason:'too-large'};
  let html='';
  for(let id=first;id<=last;id++){
    const rowIndex=data.verseIndex?.[id],row=rowIndex===undefined?null:data.verseRows?.[rowIndex];if(!row)continue;
    try{
      const content=await decryptContent(bytes(row.content),{key:bytesHex(data.keyHex),iv:bytesHex(data.ivHex)});
      const label=String(row.label||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      html+=`<div class="bible-verse" data-bible-verse="${id}"><sup>${safeText(label)}</sup> ${content}</div>`;
    }catch(err){console.warn('经文解密失败',id,err)}
  }
  return {html,data,reason:html?'':'empty'};
}
function bibleRangeTitle(data,range){
  const name=data?chineseBibleBookName(data,range.book):`第${range.book}卷`;
  return `${name} ${range.chapter}:${range.verse}${range.endChapter!==range.chapter?`–${range.endChapter}:${range.endVerse}`:range.endVerse!==range.verse?`–${range.endVerse}`:''}`;
}
const HL_SELECTOR='[data-pid],p,h1,h2,h3,h4,li,blockquote,.bible-verse';
let hlPendingRange=null,hlToolbarTimer=null,hlActiveId=null,annotationState=null;
let contextActionState=null,verseActionState=null,verseActionTarget=null,blockActionState=null,blockActionTarget=null,contextToolbarRect=null,contextBarGuardUntil=0;
let readerSearchRunId=0,readerSearchTimer=null;
let readerSearchBook=null,readerSearchKind='publications',readerSearchTab='library',readerSearchReturn=null;
const bibleSearchCache=new Map();
const publicationSearchCache=new Map();
const READER_SEARCH_KEY='offlineLibraryRecentSearches';
function hlRoot(){return $('article').querySelector('.publication-content')||$('article')}
function hlBlocks(root){return [...(root||hlRoot()).querySelectorAll(HL_SELECTOR)].filter(el=>!el.closest('rt,rp,script,style'))}
function hlBlockForNode(node){const el=node&&node.nodeType===1?node:node&&node.parentElement;return el&&el.closest?el.closest(HL_SELECTOR):null}
function visibleTextNodes(block){
  const out=[],walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT,{acceptNode(n){if(!n.data)return NodeFilter.FILTER_REJECT;if(n.parentElement&&n.parentElement.closest('rt,rp,script,style,.hl-note-mark'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});
  let n;while((n=walker.nextNode()))out.push(n);return out;
}
function visibleText(block){return visibleTextNodes(block).map(n=>n.data).join('')}
function plainTextFromRange(range){
  if(!range)return '';
  try{
    const frag=range.cloneContents();
    // Ruby annotations (pinyin) are readable on screen but must never be copied.
    frag.querySelectorAll('rt,rp,script,style').forEach(n=>n.remove());
    const box=document.createElement('div');box.appendChild(frag);
    return String(box.innerText||box.textContent||'').replace(/[\u200b-\u200d]/g,'').trim();
  }catch(e){return String(range.toString()||'').replace(/[\u200b-\u200d]/g,'').trim()}
}
function offsetInBlock(block,container,offset){
  if(!block||!container)return null;
  let pos=0;
  for(const node of visibleTextNodes(block)){
    if(node===container)return pos+offset;
    pos+=node.data.length;
  }
  return null;
}
function wrapHighlight(block,start,end,id,color){
  if(!block||!(end>start))return false;
  const nodes=visibleTextNodes(block);const targets=[];let pos=0;
  for(const node of nodes){
    const a=Math.max(start,pos),b=Math.min(end,pos+node.data.length);
    if(b>a)targets.push({node,from:a-pos,to:b-pos});
    pos+=node.data.length;
  }
  if(!targets.length)return false;
  for(let i=targets.length-1;i>=0;i--){
    const {node,from,to}=targets[i];let target=node;
    if(to<target.data.length)target.splitText(to);
    if(from>0)target=target.splitText(from);
    const span=document.createElement('span');span.className='hl';span.dataset.hlId=id;span.style.backgroundColor=color||'#ffe58a';span.style.borderRadius='3px';span.style.cursor='pointer';
    target.parentNode.insertBefore(span,target);span.appendChild(target);
  }
  return true;
}
function gutterHost(el){
  if(!el)return null;
  if(el.closest){
    const direct=el.closest('[data-pid],p,li,blockquote,.bible-verse');
    if(direct)return direct;
  }
  // Fall back to the nearest block ancestor, never an inline verse span: a
  // marker on an inline `.v` would sit in the middle of the paragraph.
  let node=el.parentElement;
  while(node){
    try{const display=getComputedStyle(node).display;if(display&&!/^inline/.test(display))return node}catch(e){}
    node=node.parentElement;
  }
  return el.parentElement;
}
function placeGutterMarker(host,btn,anchor){
  if(!host||!btn)return;
  host.classList.add('has-gutter-note');btn.classList.add('hl-gutter-note');
  let top=0;
  if(anchor){
    try{
      const hostRect=host.getBoundingClientRect();
      const rects=anchor.getClientRects?[...anchor.getClientRects()]:[];
      const r=(rects.length?rects[0]:anchor.getBoundingClientRect());
      if(r&&hostRect)top=Math.max(0,r.top-hostRect.top-(host.clientTop||0)+Math.max(0,(r.height-18)/2));
    }catch(e){}
  }
  // Keep markers on different lines from covering each other.
  const occupied=[...host.querySelectorAll('.hl-gutter-note')].map(el=>parseFloat(el.style.top)).filter(n=>Number.isFinite(n));
  while(occupied.some(v=>Math.abs(v-top)<20))top+=20;
  btn.style.top=Math.round(top)+'px';
  host.appendChild(btn);
}
function addNoteMarker(id){
  const content=hlRoot();if(!content)return;
  let spans=[];try{spans=[...content.querySelectorAll('.hl[data-hl-id="'+CSS.escape(String(id))+'"]')]}catch(e){}
  if(!spans.length)return;
  const first=spans[0],host=gutterHost(first);
  if(!host||host.querySelector('.hl-note-mark[data-hl-id="'+CSS.escape(String(id))+'"]'))return;
  const m=document.createElement('button');m.type='button';m.className='hl-note-mark';m.dataset.hlId=String(id);m.title=t('笔记');
  placeGutterMarker(host,m,first);
}
function addVerseNoteMarker(note){
  if(!note||note.kind!=='verse')return;
  const content=hlRoot();if(!content)return;
  const b=Number(note.bibleBook),c=Number(note.bibleChapter),v=Number(note.verseId);
  let verse=null;
  if(b&&c&&v){try{verse=content.querySelector('[id^="v'+b+'-'+c+'-'+v+'-"]')}catch(e){}}
  if(!verse)return;
  const host=gutterHost(verse);if(!host)return;
  if(host.querySelector('.hl-note-mark[data-note-id="'+CSS.escape(String(note.id))+'"]'))return;
  const m=document.createElement('button');m.type='button';m.className='hl-note-mark';m.dataset.noteId=String(note.id);m.title=note.title||t('笔记');
  placeGutterMarker(host,m,verse);
}
async function applyVerseNotesForDoc(bookId,docId){
  let notes=[];try{notes=await reqP(tx('notes').getAll())}catch(e){return}
  for(const n of notes)if(n.kind==='verse'&&String(n.bookId)===String(bookId)&&String(n.docId)===String(docId))addVerseNoteMarker(n);
}
function addBlockNoteMarker(note){
  if(!note)return;
  const content=hlRoot();if(!content)return;
  let block=null;
  if(note.pid){try{block=content.querySelector('[data-pid="'+CSS.escape(String(note.pid))+'"]')}catch(e){}}
  if(!block&&Number.isFinite(Number(note.blockIndex)))block=hlBlocks(content)[Number(note.blockIndex)]||null;
  if(!block)return;
  const host=gutterHost(block);if(!host)return;
  if(host.querySelector('.hl-note-mark[data-note-id="'+CSS.escape(String(note.id))+'"]'))return;
  const m=document.createElement('button');m.type='button';m.className='hl-note-mark';m.dataset.noteId=String(note.id);m.title=note.title||t('笔记');
  placeGutterMarker(host,m,block);
}
async function applyBlockNotesForDoc(bookId,docId){
  let notes=[];try{notes=await reqP(tx('notes').getAll())}catch(e){return}
  for(const n of notes)if(n.kind==='paragraph'&&String(n.bookId)===String(bookId)&&String(n.docId)===String(docId))addBlockNoteMarker(n);
}
async function openVerseNote(noteId){
  const note=await getOne('notes',noteId);if(!note)return;
  hideVerseActions();
  const h={id:'verse-note-'+note.id,bookId:note.bookId,docId:note.docId,seriesKey:note.seriesKey||seriesKeyFor(currentBook),mepsDocId:note.mepsDocId||'',pid:note.pid||'',quote:note.title||'',color:'#ffe58a',noteId:note.id};
  const data=note.kind==='verse'
    ?{kind:'verse',verseId:String(note.verseId||''),bibleBook:note.bibleBook,bibleChapter:note.bibleChapter}
    :{kind:note.kind||'paragraph',pid:note.pid||''};
  await openAnnotationEditor(h,note,false,{virtual:true,data});
}
function removeNoteMarker(id){
  try{document.querySelectorAll('.hl-note-mark[data-hl-id="'+CSS.escape(String(id))+'"],.hl-note-mark[data-note-id="'+CSS.escape(String(id))+'"]').forEach(el=>el.remove())}catch(e){}
}
async function applyHighlightsForDoc(bookId,docId){
  const content=hlRoot();if(!content)return;
  let list=[];try{list=await getHighlightsForDoc(String(bookId),String(docId))}catch(e){return}
  const blocks=hlBlocks(content);
  list.sort((a,b)=>Number(a.blockIndex||0)-Number(b.blockIndex||0)||Number(a.startOffset||0)-Number(b.startOffset||0));
  for(const h of list){
    let block=null;
    if(h.pid){try{block=content.querySelector('[data-pid="'+CSS.escape(String(h.pid))+'"]')}catch(e){}}
    if(!block&&Number.isFinite(Number(h.blockIndex)))block=blocks[Number(h.blockIndex)];
    if(!block)continue;
    const text=visibleText(block);let start=Number(h.startOffset||0),end=Number(h.endOffset||0);
    if(!h.quote||text.slice(start,end)!==h.quote){
      const idx=h.quote?text.indexOf(h.quote,Math.max(0,start-30)): -1;
      const idx2=idx<0&&h.quote?text.indexOf(h.quote): -1;
      if(idx<0&&idx2<0)continue;
      start=idx>=0?idx:idx2;end=start+h.quote.length;
    }
    wrapHighlight(block,start,end,h.id,h.color);
    if(h.noteId){const n=await getOne('notes',h.noteId);if(n)addNoteMarker(h.id)}
  }
}
async function crossLanguageNotesFor(book,doc){
  if(!book||!doc||!doc.mepsId)return [];
  const series=seriesKeyFor(book),all=await allBooks();
  const siblingIds=new Set(all.filter(b=>String(b.id)!==String(book.id)&&seriesKeyFor(b)===series).map(b=>String(b.id)));
  if(!siblingIds.size)return [];
  const out=[],seen=new Set();
  try{
    const docs=await findDocsByMeps(Number(doc.mepsId));
    for(const rec of docs){
      if(!siblingIds.has(String(rec.bookId)))continue;
      const hs=await getHighlightsForDoc(rec.bookId,rec.docId);
      for(const h of hs){
        if(!h.pid||!h.noteId)continue;
        const n=await getOne('notes',h.noteId);
        if(!n||n.kind==='answer')continue;
        if(seen.has(String(n.id)))continue;seen.add(String(n.id));
        out.push({note:n,pid:String(h.pid),bookId:rec.bookId});
      }
    }
  }catch(e){}
  try{
    const notes=await reqP(tx('notes').getAll());
    for(const n of notes){
      if(!n.bookId||!siblingIds.has(String(n.bookId))||n.kind==='answer')continue;
      if(String(n.mepsDocId||'')!==String(doc.mepsId)||!n.pid)continue;
      if(seen.has(String(n.id)))continue;seen.add(String(n.id));
      out.push({note:n,pid:String(n.pid),bookId:n.bookId});
    }
  }catch(e){}
  return out;
}
async function applyCrossLanguageNotes(book,doc){
  const content=hlRoot();if(!content)return;
  const list=await crossLanguageNotesFor(book,doc);if(!list.length)return;
  for(const item of list){
    let block=null;
    try{block=content.querySelector('[data-pid="'+String(item.pid).replace(/"/g,'')+'"]')}catch(e){}
    if(!block)continue;
    const n=item.note;
    if(!n||(!n.text&&!n.title))continue;
    const btn=document.createElement('button');btn.type='button';btn.className='hl-note-mark hl-note-foreign';btn.title=t('其他语言笔记');
    btn.onclick=e=>{e.stopPropagation();e.preventDefault();const body=[n.title,n.text].filter(Boolean).join('\n\n')||t('（无正文）');say(t('其他语言笔记'),body)};
    placeGutterMarker(gutterHost(block)||block,btn,block);
  }
}

function recentReaderSearches(){
  try{const list=JSON.parse(localStorage.getItem(READER_SEARCH_KEY)||'[]');return Array.isArray(list)?list.filter(x=>typeof x==='string'&&x.trim()).slice(0,5):[]}catch(e){return[]}
}
function rememberReaderSearch(q){
  q=String(q||'').trim().slice(0,80);if(!q)return;
  const list=[q,...recentReaderSearches().filter(x=>x!==q)].slice(0,5);
  try{localStorage.setItem(READER_SEARCH_KEY,JSON.stringify(list))}catch(e){}
  renderReaderSearchRecent();
}
function renderReaderSearchRecent(){
  const box=$('readerSearchRecent');if(!box)return;
  const list=recentReaderSearches();box.innerHTML='';
  if(!list.length){box.style.display='none';return}
  const label=document.createElement('div');label.className='reader-search-label';label.textContent=t('最近搜索');box.appendChild(label);
  const chips=document.createElement('div');chips.className='reader-search-chips';
  list.forEach(q=>{const b=document.createElement('button');b.type='button';b.className='reader-search-chip';b.textContent=q;b.onclick=()=>{const input=$('readerSearchInput');if(input)input.value=q;runReaderSearch(q,true)};chips.appendChild(b)});
  box.appendChild(chips);box.style.display='block';
}
function readerSearchScopeLabel(){
  if(readerSearchKind==='bible'&&readerSearchBook){
    return `${t('搜索范围')}：${t('圣经')} · ${readerSearchBook.displayTitle||readerSearchBook.title||''}`;
  }
  return `${t('搜索范围')}：${t('所有已导入出版物')}`;
}
async function openReaderSearch(opts={}){
  const panel=$('readerSearchPanel');if(!panel)return;
  readerSearchReturn=null;
  let kind=opts.kind,book=opts.book||null,tab=opts.tab||primarySection||'library';
  const readerOpen=$('reader').style.display==='block';
  if(!kind){
    if(readerOpen&&currentBook){book=currentBook;kind=currentBook.bibleData?'bible':'publications';tab=readerSessionTab||readerOriginSection||primarySection||'library'}
    else if(primarySection==='bible'){kind='bible';tab='bible'}
    else{kind='publications';tab=primarySection||'library'}
  }
  if(kind==='bible'&&!book){
    const id=opts.bookId||currentBibleId;
    if(id){try{book=await loadBookAuxOnly(id)}catch(e){}}
  }
  readerSearchKind=kind==='bible'?'bible':'publications';
  readerSearchBook=book||null;
  readerSearchTab=tab;
  rememberPanelFocus(panel);panel.classList.add('show');
  const scope=$('readerSearchScope');if(scope)scope.textContent=readerSearchScopeLabel();
  const results=$('readerSearchResults');if(results)results.innerHTML='';
  const input=$('readerSearchInput');if(input)input.value='';
  renderReaderSearchRecent();
  requestAnimationFrame(()=>{try{$('readerSearchInput').focus()}catch(e){}});
}
async function restoreReaderSearch(state){
  if(!state)return;
  await openReaderSearch({kind:state.kind,bookId:state.bookId,tab:state.tab});
  const input=$('readerSearchInput');if(input)input.value=state.query||'';
  if(state.query)await runReaderSearch(state.query,false);
}
function closeReaderSearch(){
  readerSearchRunId++;if(readerSearchTimer){clearTimeout(readerSearchTimer);readerSearchTimer=null}
  const panel=$('readerSearchPanel');if(panel){panel.classList.remove('show');restorePanelFocus(panel)}
}
function prepareReaderSearchReturn(q){
  readerSearchReturn={kind:readerSearchKind,query:String(q||''),tab:readerSearchTab,bookId:readerSearchBook&&readerSearchBook.id};
}
function readerSearchStatus(box,text){
  const d=document.createElement('div');d.className='reader-search-status';d.textContent=text;box.appendChild(d);return d;
}
function readerSearchSnippet(text,q){
  const value=String(text||''),at=value.toLowerCase().indexOf(String(q||'').toLowerCase());
  if(at<0)return value.slice(0,100)+(value.length>100?'…':'');
  const start=Math.max(0,at-28),end=Math.min(value.length,at+Math.max(56,String(q||'').length+28));
  return (start>0?'…':'')+value.slice(start,end)+(end<value.length?'…':'');
}
function renderReaderSearchHits(q,hits,openResult){
  const box=$('readerSearchResults');if(!box)return;box.innerHTML='';
  if(!hits.length){readerSearchStatus(box,t('没有找到匹配结果'));return}
  for(const hit of hits){
    const b=document.createElement('button');b.type='button';b.className='reader-search-result';
    const title=document.createElement('strong');title.textContent=hit.label;
    const snippet=document.createElement('span');snippet.textContent=readerSearchSnippet(hit.text,q);
    b.append(title,snippet);
    b.onclick=async()=>{
      rememberReaderSearch(q);prepareReaderSearchReturn(q);closeReaderSearch();
      try{await openResult(hit)}catch(e){}
    };
    box.appendChild(b);
  }
}
async function runReaderSearch(raw,remember){
  const q=String(raw||'').trim();const box=$('readerSearchResults');if(!box)return;
  renderReaderSearchRecent();
  if(!q){box.innerHTML='';return}
  if(remember)rememberReaderSearch(q);
  const run=++readerSearchRunId;
  box.innerHTML='';const status=readerSearchStatus(box,t('搜索中…'));
  try{
    if(readerSearchKind==='bible'&&readerSearchBook&&readerSearchBook.bibleData)await searchBibleForReader(run,q,status);
    else await searchAllPublicationsForReader(run,q,status);
  }catch(e){
    if(run===readerSearchRunId){box.innerHTML='';readerSearchStatus(box,e&&e.message||String(e))}
  }
}
function publicationSearchKey(meta){return String(meta.id)+':'+String(meta.gen||'')}
async function publicationSearchRecord(meta){
  const key=publicationSearchKey(meta);
  let rec=publicationSearchCache.get(key);
  if(rec)return rec;
  const book=await loadBook(meta.id);
  if(!book)return null;
  const docs=[];
  for(const d of book.docs||[]){
    const html=String(d&&d.html||''),blocks=[];
    if(html){
      const doc=new DOMParser().parseFromString(html,'text/html');
      doc.querySelectorAll('rt,rp,script,style').forEach(n=>n.remove());
      const hasPid=!!doc.querySelector('[data-pid]');
      const nodes=hasPid?[...doc.querySelectorAll('[data-pid]')]:[...doc.querySelectorAll('p,li,h1,h2,h3,blockquote')];
      for(const node of nodes){
        const text=(node.textContent||'').replace(/[\s\u200b-\u200d]+/g,' ').trim();
        if(text)blocks.push({pid:node.getAttribute('data-pid')||'',text});
      }
    }
    docs.push({docId:d.id,title:d.title||'',blocks});
  }
  rec={meta,docs};publicationSearchCache.set(key,rec);return rec;
}
async function searchAllPublicationsForReader(run,q,status){
  const metas=await allBooks();if(run!==readerSearchRunId)return;
  const lower=q.toLowerCase(),hits=[],seen=new Set();
  for(const meta of metas){
    if(meta.hasBible)continue;
    const title=String(meta.displayTitle||meta.title||'');
    if(title&&title.toLowerCase().includes(lower))hits.push({bookId:meta.id,docId:null,pid:'',label:title,text:title});
  }
  const searchable=metas.filter(m=>!m.hasBible);
  for(let i=0;i<searchable.length;i++){
    if(run!==readerSearchRunId)return;
    const meta=searchable[i],bookTitle=String(meta.displayTitle||meta.title||'');
    status.textContent=t('搜索中…')+` ${i+1}/${searchable.length}`;
    const rec=await publicationSearchRecord(meta);
    if(!rec){await new Promise(r=>setTimeout(r,0));continue}
    for(const d of rec.docs){
      const docTitle=String(d.title||'');
      if(docTitle&&docTitle.toLowerCase().includes(lower)){
        const key=meta.id+':'+d.docId+':title';
        if(!seen.has(key)){seen.add(key);hits.push({bookId:meta.id,docId:d.docId,pid:'',label:`${bookTitle} · ${docTitle}`,text:docTitle})}
      }
      for(const block of d.blocks){
        if(!block.text.toLowerCase().includes(lower))continue;
        const key=meta.id+':'+d.docId+':'+(block.pid||block.text.slice(0,40));
        if(seen.has(key))continue;seen.add(key);
        hits.push({bookId:meta.id,docId:d.docId,pid:block.pid,label:`${bookTitle} · ${docTitle}`,text:block.text});
        if(hits.length>=80)break;
      }
      if(hits.length>=80)break;
    }
    if(hits.length>=80)break;
    await new Promise(r=>setTimeout(r,0));
  }
  if(run!==readerSearchRunId)return;
  renderReaderSearchHits(q,hits,async hit=>{
    const book=await loadBook(hit.bookId);if(!book)return;
    const docId=hit.docId||(book.docs&&book.docs[0]&&book.docs[0].id);
    if(docId!==undefined&&docId!==null)await openDocInBook(book,docId,hit.pid?'#p'+hit.pid:'',readerSearchTab);
    else await openBook(book.id);
  });
}
async function searchBibleForReader(run,q,status){
  const book=readerSearchBook;if(!book||!book.bibleData)return;
  const cache=await ensureBibleSearchIndex(book,run,status);
  if(run!==readerSearchRunId)return;
  const data=book.bibleData,lower=q.toLowerCase(),hits=[];
  const keys=[...cache.keys()].sort((a,b)=>{const x=a.split(':').map(Number),y=b.split(':').map(Number);return x[0]-y[0]||x[1]-y[1]});
  for(const key of keys){
    if(run!==readerSearchRunId)return;
    const parts=key.split(':'),b=Number(parts[0]),c=Number(parts[1]);
    for(const verse of cache.get(key)||[]){
      if(!verse.text.toLowerCase().includes(lower))continue;
      hits.push({b,c,v:verse.v,text:verse.text,label:`${chineseBibleBookName(data,b)} ${c}:${verse.v}`});
      if(hits.length>=80)break;
    }
    if(hits.length>=80)break;
  }
  renderReaderSearchHits(q,hits,hit=>openBibleChapterReader(book.id,hit.b,hit.c,hit.v,readerSearchTab||'bible'));
}
async function ensureBibleSearchIndex(book,run,status){
  const data=book&&book.bibleData;if(!data)return new Map();
  const cacheKey=String(book.id)+':'+String(book.gen||'');
  let cache=bibleSearchCache.get(cacheKey);
  if(!cache){cache=new Map();bibleSearchCache.set(cacheKey,cache)}
  const allKeys=Object.keys(data.chapterIndex&&Object.keys(data.chapterIndex).length?data.chapterIndex:(data.chapters||{}));
  const todo=allKeys.filter(k=>!cache.has(k));
  if(todo.length)status.textContent=t('正在准备经文索引…')+` 0/${todo.length}`;
  let done=0;
  for(const key of todo){
    if(run!==readerSearchRunId)return cache;
    const parts=key.split(':'),b=Number(parts[0]),c=Number(parts[1]);
    let verses=[];try{verses=await bibleVersesForSearch(data,b,c)}catch(e){}
    cache.set(key,verses);done++;
    if(done%20===0||done===todo.length){
      if(run!==readerSearchRunId)return cache;
      status.textContent=t('正在准备经文索引…')+` ${done}/${todo.length}`;
      await new Promise(r=>setTimeout(r,0));
    }
  }
  if(run===readerSearchRunId)status.textContent=t('搜索中…');
  return cache;
}
async function bibleVersesForSearch(data,b,c){
  const key=`${b}:${c}`,idx=data.chapterIndex?.[key],row=idx!==undefined?data.chapterRows?.[idx]:null;
  let html='';
  if(row&&row.content){try{html=await decryptContent(bytes(row.content),{key:bytesHex(data.keyHex),iv:bytesHex(data.ivHex)})}catch(e){}}
  if(html){const verses=versesFromChapterHtml(html);if(verses.length)return verses}
  const ch=data.chapters?.[key];if(!ch)return [];
  const out=[];
  for(let id=Number(ch.firstVerseId);id<=Number(ch.lastVerseId);id++){
    const ri=data.verseIndex?.[id],vr=ri===undefined?null:data.verseRows?.[ri];if(!vr)continue;
    try{
      const text=await decryptContent(bytes(vr.content),{key:bytesHex(data.keyHex),iv:bytesHex(data.ivHex)});
      const clean=plainText(text);
      const v=Number(String(vr.label||'').replace(/<[^>]+>/g,''))||(id-Number(ch.firstNumberedVerseId||ch.firstVerseId)+1);
      if(clean)out.push({v,text:clean});
    }catch(e){}
  }
  return out;
}
function versesFromChapterHtml(html){
  const doc=new DOMParser().parseFromString(String(html||''),'text/html');
  const nodes=[...doc.querySelectorAll('.v')];
  const out=[];
  if(!nodes.length){
    doc.querySelectorAll('rt,rp,.tt,.fn,.m,.vl,.cl,.fcc,script,style').forEach(n=>n.remove());
    const text=(doc.body?doc.body.textContent:'').replace(/[\s\u200b-\u200d]+/g,' ').trim();
    if(text)out.push({v:1,text});
    return out;
  }
  const byVerse=new Map();
  for(const node of nodes){
    const m=/^v\d+-\d+-(\d+)/.exec(node.id||'');
    let num=m?Number(m[1]):0;
    if(!num){const label=node.querySelector('.vl,.cl');const n=parseInt(String(label&&label.textContent||''),10);if(Number.isFinite(n))num=n}
    node.querySelectorAll('rt,rp,.tt,.fn,.m,.vl,.cl,.fcc,script,style').forEach(n=>n.remove());
    const text=(node.textContent||'').replace(/[\s\u200b-\u200d]+/g,' ').trim();
    if(!num||!text)continue;
    if(!byVerse.has(num))byVerse.set(num,[]);
    byVerse.get(num).push(text);
  }
  for(const [v,parts] of byVerse)out.push({v,text:parts.join(' ')});
  return out;
}
function hideContextActions(){
  const bar=$('contextActions');
  if(bar){bar.classList.remove('show','mode-verse','mode-selection','mode-highlight','mode-block','colors-open');const ct=bar.querySelector('.ctx-color-toggle');if(ct)ct.setAttribute('aria-expanded','false');bar.querySelectorAll('[data-context-color]').forEach(b=>b.classList.remove('active'))}
  if(verseActionTarget&&verseActionTarget.classList)verseActionTarget.classList.remove('verse-action-active');
  if(blockActionTarget&&blockActionTarget.classList)blockActionTarget.classList.remove('block-action-active');
  document.querySelectorAll('.hl.context-highlight-active').forEach(el=>el.classList.remove('context-highlight-active'));
  contextActionState=null;verseActionTarget=null;verseActionState=null;blockActionState=null;blockActionTarget=null;hlPendingRange=null;hlActiveId=null;contextToolbarRect=null;
}
function clearNativeArticleSelection(){
  try{
    const sel=window.getSelection();
    if(sel&&!sel.isCollapsed&&$('article')&&$('article').contains(sel.anchorNode))sel.removeAllRanges();
  }catch(e){}
}
function dismissRegionSelection(){
  hideContextActions();
  clearNativeArticleSelection();
}
function hideVerseActions(){hideContextActions()}
function hideHighlightToolbar(){hideContextActions()}
function rangePlacementRect(range,fallback){
  let rects=[];try{rects=[...range.getClientRects()].filter(r=>r.width||r.height)}catch(e){}
  if(!rects.length)return fallback;
  const first=rects[0],last=rects[rects.length-1];
  let left=Infinity,right=-Infinity;
  rects.forEach(r=>{left=Math.min(left,r.left);right=Math.max(right,r.right)});
  return {top:first.top,bottom:last.bottom,left,width:right-left,height:last.height||first.height||24,lineHeight:last.height||first.height||24};
}
function placeSelectionToolbar(bar,rect){
  const w=bar.offsetWidth||180,h=bar.offsetHeight||44;
  const vv=window.visualViewport;
  const vw=vv?vv.width:window.innerWidth,vh=vv?vv.height:window.innerHeight;
  // Keep one line of space plus enough room for the native selection menu.
  // We cannot read the system menu's position, so reserve its height on the
  // chosen side: whether the system menu opens above or below the selection,
  // our bar then sits beyond it instead of underneath it.
  const line=Math.max(30,Math.min(48,(rect.lineHeight||rect.height||24)*1.3));
  // A one-line gap alone lands inside the native selection menu, so always
  // reserve a full menu height as well. This also covers touch-capable
  // laptops where `(pointer:coarse)` can still report false.
  const nativeMenu=88;
  const clear=line+nativeMenu;
  const minTop=8,maxTop=Math.max(minTop,vh-h-12);
  const above=rect.top-h-clear,below=rect.bottom+clear;
  const roomAbove=rect.top-minTop,roomBelow=maxTop-rect.bottom;
  let top;
  if(above>=minTop)top=above;
  else if(below+h<=maxTop)top=below;
  else top=roomAbove>=roomBelow?Math.max(minTop,above):Math.min(maxTop,below);
  const left=Math.max(8,Math.min(rect.left+rect.width/2-w/2,vw-w-8));
  bar.style.left=left+'px';bar.style.top=top+'px';
}
function showContextActions(state,rect){
  if(!state)return;
  hideContextActions();
  const bar=$('contextActions');if(!bar)return;
  contextActionState=state;
  bar.classList.add('show','mode-'+state.kind);
  if(state.kind==='verse'){
    verseActionState=state.ctx;verseActionTarget=state.ctx.el;
    if(verseActionTarget&&verseActionTarget.classList)verseActionTarget.classList.add('verse-action-active');
  }else if(state.kind==='highlight'){
    hlActiveId=String(state.highlightId);
    try{document.querySelectorAll('.hl[data-hl-id="'+CSS.escape(String(state.highlightId))+'"]').forEach(el=>el.classList.add('context-highlight-active'))}catch(e){}
    bar.querySelectorAll('[data-context-color]').forEach(b=>b.classList.toggle('active',String(b.getAttribute('data-context-color')).toLowerCase()===String(state.color||'').toLowerCase()));
  }else if(state.kind==='selection'){
    hlPendingRange=state.range;
  }else if(state.kind==='block'){
    blockActionState=state;blockActionTarget=state.el;
    if(blockActionTarget&&blockActionTarget.classList)blockActionTarget.classList.add('block-action-active');
  }
  const infoBtn=bar.querySelector('[data-context-act="info"]');
  if(infoBtn){
    const key=state.kind==='block'?'段落信息':'经文信息';
    infoBtn.setAttribute('data-i18n-title',key);infoBtn.setAttribute('data-i18n-aria-label',key);
    infoBtn.title=t(key);infoBtn.setAttribute('aria-label',t(key));
  }
  if(!rect)rect={left:window.innerWidth/2,top:window.innerHeight/2,bottom:window.innerHeight/2,width:0,height:0};
  if(state.kind==='selection'&&state.range)rect=rangePlacementRect(state.range,rect);
  contextToolbarRect=rect;
  placeSelectionToolbar(bar,rect);
}
function scheduleHighlightToolbar(e){
  if(Date.now()<contextBarGuardUntil)return;
  if(e&&e.target&&e.target.closest&&e.target.closest('#contextActions'))return;
  if(hlToolbarTimer)clearTimeout(hlToolbarTimer);
  hlToolbarTimer=setTimeout(()=>{
    if(Date.now()<contextBarGuardUntil)return;
    const sel=window.getSelection();
    if(!sel||!sel.rangeCount||sel.isCollapsed||!$('article')){
      if(contextActionState&&contextActionState.kind==='selection')hideContextActions();
      return;
    }
    const range=sel.getRangeAt(0);
    if(!$('article').contains(range.commonAncestorContainer)){if(contextActionState&&contextActionState.kind==='selection')hideContextActions();return}
    const p=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
    if(p&&p.closest&&p.closest('.hl')){if(contextActionState&&contextActionState.kind==='selection')hideContextActions();return}
    const rect=range.getBoundingClientRect();if(!rect||(!rect.width&&!rect.height)){if(contextActionState&&contextActionState.kind==='selection')hideContextActions();return}
    showContextActions({kind:'selection',range:range.cloneRange()},rect);
  },80);
}
async function showHighlightActions(el,id){
  if(!el||!id)return;
  let h=null;try{h=await getOne('highlights',id)}catch(e){}
  if(!h)return;
  showContextActions({kind:'highlight',highlightId:String(id),color:h.color||''},el.getBoundingClientRect());
}
async function updateHighlightColor(id,color){
  const h=await getOne('highlights',id);if(!h)return;
  h.color=color;await saveHighlight(h);
  document.querySelectorAll('.hl[data-hl-id="'+CSS.escape(String(id))+'"]').forEach(el=>{el.style.backgroundColor=color});
}
async function clearHighlight(id){
  const h=await getOne('highlights',id);if(!h)return;
  if(h.noteId&&!(await askConfirm(t('清除颜色'),'清除这个高亮颜色？关联笔记会保留。')))return;
  try{await reqP(tx('highlights','readwrite').delete(id))}catch(e){}
  const spans=[...document.querySelectorAll('.hl[data-hl-id="'+CSS.escape(String(id))+'"]')];
  for(const span of spans){
    const parent=span.parentNode;if(!parent)continue;
    while(span.firstChild)parent.insertBefore(span.firstChild,span);
    parent.removeChild(span);
  }
  removeNoteMarker(id);
}
async function createHighlightFromRange(range,color){
  if(!currentBook||currentIndex<0)return;
  const d=currentBook.docs[currentIndex];if(!d)return;
  const startBlock=hlBlockForNode(range.startContainer),endBlock=hlBlockForNode(range.endContainer);
  if(!startBlock||startBlock!==endBlock){say('高亮范围','请在同一段文字内选择需要高亮的内容。');return}
  const existing=[...startBlock.querySelectorAll('.hl')];
  try{if(existing.some(el=>range.intersectsNode(el))){say('已有高亮','这个范围已经有高亮。');return}}catch(e){}
  const blockText=visibleText(startBlock);
  let start=offsetInBlock(startBlock,range.startContainer,range.startOffset);
  let end=offsetInBlock(startBlock,range.endContainer,range.endOffset);
  if(start===null||end===null||end<=start){
    const q=plainTextFromRange(range).replace(/\s+/g,' ').trim();
    if(!q)return;const i=blockText.indexOf(q);if(i<0)return;start=i;end=i+q.length;
  }
  const quote=blockText.slice(start,end);
  if(!quote.trim())return;
  const content=hlRoot();
  const h={id:'hl-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),bookId:String(currentBook.id),docId:String(d.id),seriesKey:seriesKeyFor(currentBook),mepsDocId:String(d.mepsId||''),pid:startBlock.getAttribute('data-pid')||'',blockIndex:hlBlocks(content).indexOf(startBlock),startOffset:start,endOffset:end,quote,color:color||'#ffe58a',noteId:null,createdAt:Date.now()};
  try{await saveHighlight(h)}catch(e){say('保存失败',e&&e.message||String(e));return}
  wrapHighlight(startBlock,start,end,h.id,h.color);
  hideHighlightToolbar();
  try{window.getSelection().removeAllRanges()}catch(e){}
  return h;
}
async function openAnnotationEditor(highlight,note,draft,extra){
  studyState.tags=await allTags();
  if(!note)note={id:noteIdForNew(),title:String(highlight.quote||'').slice(0,40)||'笔记',text:'',tagIds:[],bookId:highlight.bookId,docId:highlight.docId,seriesKey:highlight.seriesKey||'',mepsDocId:highlight.mepsDocId||'',pid:highlight.pid||'',highlightId:highlight.id,createdAt:Date.now(),updatedAt:Date.now()};
  annotationState={highlight,note,draft:!!draft,extra:extra||null,virtual:!!(extra&&extra.virtual),selectedTags:new Set(Array.isArray(note.tagIds)?note.tagIds:[])};
  $('annotationQuote').textContent=highlight.quote||'';
  $('annotationTitle').value=note.title||'';
  $('annotationText').value=note.text||'';
  editorTagPicker($('annotationTags'),annotationState.selectedTags,ids=>{annotationState.selectedTags=new Set(ids)});
  rememberPanelFocus($('annotationEditor'));$('annotationEditor').classList.add('show');setTimeout(()=>focusSafely($('annotationTitle')),0);
}
async function openHighlightNote(id){
  hideVerseActions();
  const h=await getOne('highlights',id);if(!h)return;
  let note=h.noteId?await getOne('notes',h.noteId):null;
  await openAnnotationEditor(h,note,!note);
}
function closeAnnotationEditor(){const p=$('annotationEditor');p.classList.remove('show');annotationState=null;restorePanelFocus(p)}
async function saveAnnotation(){
  if(!annotationState)return;
  const {highlight,note,selectedTags}=annotationState;
  note.title=String($('annotationTitle').value||'').trim()||String(highlight.quote||'').slice(0,40)||'笔记';
  if(highlight){if(!note.seriesKey)note.seriesKey=highlight.seriesKey||seriesKeyFor(currentBook);if(!note.mepsDocId)note.mepsDocId=highlight.mepsDocId||'';if(!note.pid)note.pid=highlight.pid||'';}
  if(annotationState.extra&&annotationState.extra.data)Object.assign(note,annotationState.extra.data);
  note.text=String($('annotationText').value||'');
  note.tagIds=[...selectedTags];note.updatedAt=Date.now();
  await saveOne('notes',note);
  if(highlight&&!annotationState.virtual&&highlight.noteId!==note.id){highlight.noteId=note.id;await saveHighlight(highlight);addNoteMarker(highlight.id)}
  if(note.kind==='verse')await applyVerseNotesForDoc(note.bookId,note.docId);
  else if(note.kind==='paragraph')await applyBlockNotesForDoc(note.bookId,note.docId);
  closeAnnotationEditor();
}
async function deleteAnnotation(){
  if(!annotationState)return;
  const {highlight,note,draft}=annotationState;
  if(draft){closeAnnotationEditor();return}
  if(!(await askConfirm(t('删除'),'删除这条笔记？高亮会保留。')))return;
  try{await deleteNoteCascade(note.id)}catch(e){}
  removeNoteMarker(highlight.id);removeNoteMarker(note.id);
  closeAnnotationEditor();
}
function closeAnnotationsPanel(){const p=$('annotationsPanel');p.classList.remove('show');restorePanelFocus(p)}
async function openChapterNotes(){
  if(!currentBook||currentIndex<0)return;
  const d=currentBook.docs[currentIndex];if(!d)return;
  const list=await getHighlightsForDoc(currentBook.id,d.id);
  const box=$('annotationsList');box.innerHTML='';
  $('annotationsTitle').textContent=t('本章笔记');
  if(!list.length){const e=document.createElement('div');e.className='section-empty';e.textContent=t('本章还没有划线笔记。');box.appendChild(e)}
  else{
    const notes=await Promise.all(list.map(h=>h.noteId?getOne('notes',h.noteId):null));
    const rows=list.map((h,i)=>({h,n:notes[i]})).sort((a,b)=>Number(a.h.blockIndex||0)-Number(b.h.blockIndex||0)||Number(a.h.startOffset||0)-Number(b.h.startOffset||0));
    rows.forEach(({h,n})=>{
      const b=document.createElement('button');b.className='annotation-row';
      b.innerHTML=`<span><span class="annotation-dot" style="background:${h.color||'#ffe58a'}"></span>${safeText(String(h.quote||'').slice(0,120))}</span><small>${safeText((n&&n.text)||(n&&n.title)||'')}</small>`;
      b.onclick=()=>{closeAnnotationsPanel();const el=$('article').querySelector('.hl[data-hl-id="'+String(h.id).replace(/"/g,'')+'"]');if(el)el.scrollIntoView({block:'center'});else{const blocks=hlBlocks(hlRoot());const block=blocks[Number(h.blockIndex||0)];if(block)block.scrollIntoView({block:'center'})}};
      box.appendChild(b);
    });
  }
  rememberPanelFocus($('annotationsPanel'));$('annotationsPanel').classList.add('show');setTimeout(()=>focusSafely($('annotationsClose')),0);
}
async function setupAnswerFields(bookId,docId){
  const article=$('article');if(!article)return;
  const fields=[...article.querySelectorAll('textarea, input[type="text"]')];
  if(!fields.length)return;
  const doc=currentBook&&currentBook.docs[currentIndex];
  const canonical={seriesKey:seriesKeyFor(currentBook),mepsDocId:String(doc&&doc.mepsId||'')};
  let notes=[];try{notes=await reqP(tx('notes').getAll())}catch(e){}
  const map=new Map(notes.filter(n=>n.kind==='answer'&&String(n.bookId)===String(bookId)&&String(n.docId)===String(docId)).map(n=>[String(n.fieldKey),n]));
  fields.forEach((el,idx)=>{
    const key=el.id||el.name||('field-'+idx);
    const pidEl=el.closest&&el.closest('[data-pid]');const pid=pidEl?String(pidEl.getAttribute('data-pid')||''):'';
    const saved=map.get(String(key));if(saved&&typeof saved.text==='string')el.value=saved.text;
    el.placeholder='';el.removeAttribute('placeholder');el.removeAttribute('title');
    const fieldBox=el.closest&&(el.closest('.gen-field')||el.parentElement);
    if(fieldBox)fieldBox.querySelectorAll('label').forEach(l=>{l.style.display='none'});
    const grow=()=>{
      if(el.tagName!=='TEXTAREA')return;
      el.style.height='auto';
      const border=Math.max(0,(el.offsetHeight||0)-(el.clientHeight||0));
      el.style.height=Math.max(38,Number(el.scrollHeight||0)+border)+'px';
      el.style.minHeight='38px';
      el.style.overflowY='hidden';
    };
    grow();requestAnimationFrame(grow);setTimeout(grow,300);
    let timer=null;
    el.addEventListener('input',()=>{
      grow();clearTimeout(timer);
      timer=setTimeout(async()=>{
        try{await saveOne('notes',{id:'answer:'+bookId+':'+docId+':'+key,kind:'answer',bookId:String(bookId),docId:String(docId),seriesKey:canonical.seriesKey,mepsDocId:canonical.mepsDocId,pid,fieldKey:String(key),text:el.value,updatedAt:Date.now()})}catch(e){}
      },400);
    });
  });
}
async function openBiblePassage(bibleBook,range,href,anchorEl){
  const r=await bibleRangeHtml(bibleBook,range);
  if(!r.html){
    if(r.reason==='no-data')say('缺少经文正文','这份出版物没有保存 BibleVerse 经文数据。请先导入对应语言的圣经 PUB。');
    else if(r.reason==='too-large')say('经文范围过大','本阅读器一次最多显示 120 节，请缩小经文范围。');
    else if(r.reason==='no-index')say('找不到经文索引',`已经识别经文位置：${range.book}:${range.chapter}:${range.verse}-${range.endChapter}:${range.endVerse}\n但这份圣经文件没有提供足够的经文编号索引。请尝试导入参考版《新世界译本圣经》PUB。`);
    else say('没有经文正文','这份圣经文件中没有找到对应经文正文。');
    return;
  }
  await showLinkPopover(bibleRangeTitle(r.data,range),r.html,bibleBook,anchorEl);
}
async function openBibleVersions(versions,range,href,anchorEl){
  let html='',first=null,titleData=null;
  for(const v of versions){
    const r=await bibleRangeHtml(v,range);
    if(!r.html){if(!titleData&&r.data)titleData=r.data;continue}
    if(!first){first=v;titleData=r.data}
    html+=`<div class="bible-version-block"><h3>${safeText(v.displayTitle||v.title)}</h3>${r.html}</div>`;
  }
  if(!html){say('没有经文正文','已检查本机导入的圣经译本，但没有找到这段经文的可显示正文。');return}
  await showLinkPopover(bibleRangeTitle(titleData,range),html,first,anchorEl);
}

function normalizePubHref(value){
  let v=String(value||'').trim();
  if(!v)return '';
  if(/^p\//i.test(v))v='jwpub://'+v;
  else if(/^\/p\//i.test(v))v='jwpub:/'+v;
  return v;
}
function languageFallbackNotice(sourceLang,targetLang){
  if(!sourceLang||!targetLang||Number(sourceLang)===Number(targetLang))return '';
  return `<p class="language-fallback-note">当前语言版本没有这条内容，以下显示${safeText(contentLangName(targetLang))}版本。</p>`;
}
function publicationTargetFromExtract(extract){
  const raw=normalizePubHref(extract&&(extract.sourceLink||extract.link));
  const info=parsePublicationLink(raw);
  return {raw,docId:Number(info?.docId||extract?.refDocId||0),first:Number(info?.paragraph||extract?.refBegin||0),last:Number(info?.lastParagraph||extract?.refEnd||info?.paragraph||0)};
}
function publicationLinkKey(href){
  const info=parsePublicationLink(normalizePubHref(href));
  if(!info)return String(href||'').toLowerCase();
  return `${info.docId}:${info.paragraph||0}:${info.lastParagraph||0}`;
}
function extractMatchesLink(extract,parsed,originalHref){
  const info=publicationTargetFromExtract(extract);
  if(!info.docId||Number(info.docId)!==Number(parsed.docId))return false;
  if(originalHref&&info.raw&&publicationLinkKey(info.raw)===publicationLinkKey(originalHref))return true;
  if(parsed.paragraph){
    const reqFirst=Number(parsed.paragraph),reqLast=Number(parsed.lastParagraph||parsed.paragraph);
    if(info.first&&reqLast<info.first)return false;
    if(info.last&&reqFirst>info.last)return false;
  }
  return true;
}
function extractLinkScore(extract,parsed,originalHref,currentDocId,anchorPid){
  const info=publicationTargetFromExtract(extract);
  let score=0;
  if(originalHref&&info.raw&&publicationLinkKey(info.raw)===publicationLinkKey(originalHref))score+=1000;
  if(currentDocId&&String(extract.sourceDocId||0)===String(currentDocId))score+=400;
  if(anchorPid&&Number(extract.beginPid||0)===Number(anchorPid))score+=300;
  if(parsed.paragraph&&info.first){
    const reqLast=Number(parsed.lastParagraph||parsed.paragraph);
    if(info.first===Number(parsed.paragraph))score+=250;
    else if(!(info.last<Number(parsed.paragraph)||info.first>reqLast))score+=120;
  }
  if(extract.html)score+=20;
  score+=Math.min(80,Math.max(0,Number(extract.refEnd||0)-Number(extract.refBegin||0)));
  return score;
}
async function findBibleBookDocTarget(docId){
  const books=await allBooks(),candidates=[];
  if(currentBook&&currentBook.bibleStructure&&String(currentBook.id)===String(currentBibleId))candidates.push(currentBook);
  const saved=currentBibleId;
  for(const m of books){
    if(!m.bibleStructure)continue;
    if(candidates.some(c=>String(c.id)===String(m.id)))continue;
    candidates.push(m);
  }
  candidates.sort((a,b)=>{
    const rank=x=>String(x.id)===String(saved)?0:(currentBook&&x.lang===currentBook.lang?1:2);
    return rank(a)-rank(b);
  });
  for(const m of candidates){
    const hit=(m.bibleStructure.books||[]).find(b=>Number(b.textDocId)===Number(docId));
    if(hit)return {bookId:m.id,bookNum:Number(hit.num)};
  }
  const data=currentBook&&currentBook.bibleData;
  if(data&&data.docBooks&&data.docBooks[String(docId)])return {bookId:currentBook.id,bookNum:Number(data.docBooks[String(docId)])};
  return null;
}
function publicationLinkIsDocumentLink(pub){
  // A link with a paragraph range is a citation; when the publication packages
  // an Extract excerpt we show it in the popover. A link without a range names a
  // whole document (TOC entry, chapter, song), so it must open the body even when
  // the source markup also carries data-xtid. `data-xtid` only says an Extract
  // exists; it does not mean the target is not a real document.
  return !Number(pub&&pub.paragraph);
}
async function findExactExtract(pub,href,currentDocId,anchorPid){
  const sourceLang=Number(currentBook&&currentBook.lang)||0;
  const metas=await allBooks(),candidates=[];
  const add=(extract,book,meta)=>{
    if(!extractMatchesLink(extract,pub,href))return;
    let score=extractLinkScore(extract,pub,href,currentDocId,anchorPid);
    const targetLang=Number((meta&&meta.lang)||(book&&book.lang)||0)||0;
    if(!sourceLang||!targetLang||targetLang===sourceLang)score+=120;
    candidates.push({extract,book,meta,score});
  };
  for(const ex of (currentBook&&currentBook.extracts)||[])add(ex,currentBook,null);
  for(const m of metas){
    if(String(m.id)===String(currentBook?.id))continue;
    for(const link of (m.extractLinks||[]))add(link,null,m);
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates){
    let book=c.book,extract=c.extract;
    if(c.meta){
      book=await loadBook(c.meta.id);
      extract=book&&(book.extracts||[]).find(x=>String(x.id)===String(c.extract.id));
    }
    if(extract)return {book:book||c.meta,extract,meta:c.meta};
  }
  return null;
}
async function openPublicationDocument(pub){
  if(!pub)return false;
  const metas=await allBooks();
  const metaById=new Map(metas.map(m=>[String(m.id),m]));
  const sourceLang=Number(currentBook&&currentBook.lang)||0;
  const sameLanguage=bookId=>String(bookId)===String(currentBook&&currentBook.id)||!sourceLang||Number((metaById.get(String(bookId))||{}).lang)===sourceLang;
  const anchor=pub.anchor||(pub.paragraph?`p${pub.paragraph}`:'');
  const targets=(pub.targets&&pub.targets.length?pub.targets:[pub]);
  for(const target of targets){
    const hits=await findDocsByMeps(target.docId);
    if(hits&&hits.length){
      const ordered=[
        ...hits.filter(h=>String(h.bookId)===String(currentBook?.id)),
        ...hits.filter(h=>sameLanguage(h.bookId)),
        ...hits
      ];
      const seen=new Set();
      for(const hit of ordered){
        const key=String(hit.bookId)+':'+String(hit.docId);
        if(seen.has(key))continue;seen.add(key);
        const full=(String(hit.bookId)===String(currentBook?.id)&&Array.isArray(currentBook.docs))?currentBook:await loadBook(hit.bookId);
        const found=full&&full.docs&&full.docs.find(d=>normMepsId(d.mepsId)===normMepsId(target.docId));
        if(full&&found){await openDocInBook(full,found.id,target.paragraph?`p${target.paragraph}`:anchor);return true}
      }
    }
    const bibleTarget=await findBibleBookDocTarget(target.docId);
    if(bibleTarget){
      await openBibleChapterReader(bibleTarget.bookId,bibleTarget.bookNum,1,0,readerSessionTab||readerOriginSection||primarySection||'bible');
      return true;
    }
  }
  return false;
}
async function openLinkedPublication(href){
  const pub=parsePublicationLink(normalizePubHref(href));
  if(!pub)return false;
  return await openPublicationDocument(pub);
}
async function openPublicationReference(href,anchorEl){
  const pub=parsePublicationLink(href);if(!pub)return false;
  const anchorPid=Number(anchorEl&&anchorEl.closest&&anchorEl.closest('[data-pid]')?.getAttribute('data-pid')||0);
  const currentDoc=currentBook&&currentBook.docs&&currentBook.docs[currentIndex];
  const currentDocId=currentDoc?currentDoc.id:0;
  const sourceLang=Number(currentBook&&currentBook.lang)||0;
  const wholeDoc=publicationLinkIsDocumentLink(pub);
  // A paragraph citation prefers the packaged excerpt (a temporary reference).
  // Without an excerpt it still jumps into the real document below.
  if(!wholeDoc){
    const exact=await findExactExtract(pub,href,currentDocId,anchorPid);
    if(exact&&exact.extract.html){
      const targetLang=Number((exact.meta&&exact.meta.lang)||(exact.book&&exact.book.lang)||0)||0;
      await openExtractInReader(exact.book,exact.extract,anchorEl,languageFallbackNotice(sourceLang,targetLang),{linkHref:href});
      return true;
    }
  }
  // Whole-document links, and citations whose excerpt is not packaged, open the
  // target document in the reader. Try the primary address first, then the
  // `$p/` alternatives some publications list for the same reference.
  if(await openPublicationDocument(pub))return true;
  // Some whole-document links exist only as an Extract (for example a song
  // packaged as an excerpt). Show that preview instead of a dead end.
  if(wholeDoc){
    const exact=await findExactExtract(pub,href,currentDocId,anchorPid);
    if(exact){
      const targetLang=Number((exact.meta&&exact.meta.lang)||(exact.book&&exact.book.lang)||0)||0;
      await openExtractInReader(exact.book,exact.extract,anchorEl,languageFallbackNotice(sourceLang,targetLang),{linkHref:href});
      return true;
    }
  }
  say('本地没有这条链接的正文',`出版物链接标识：${pub.prefix||''}:${pub.docId}\n目标段落：${pub.paragraph||'未指定'}\n已检查当前导入出版物的正文、圣经书卷文档和 Extract 摘录数据，但没有找到对应内容。没有尝试打开外部网页。`);
  return true;
}
async function openExtractInReader(book,extract,anchorEl,notice='',opts={}){
  const title=extract.captionText||String(extract.caption||'').replace(/<[^>]+>/g,' ').replace(/[\s\u200b]+/g,' ').trim()||t('链接内容');
  const linkHref=String(opts.linkHref||extract.sourceLink||extract.link||'');
  const titleAction=linkHref?async()=>{
    const ok=await openLinkedPublication(linkHref);
    if(!ok)say(t('相关链接'),t('本地没有这篇相关文章的正文。'));
  }:null;
  const popupOpts=titleAction?{onTitleClick:titleAction}:undefined;
  if(!extract.html){
    await showLinkPopover(title,'<p>'+t('这条相关文章的正文没有保存在本机。')+'</p><p>'+t('它很可能是在旧版（0.5.1 及更早）导入的；旧版只保存了链接和标题，没有保存 Extract 正文。请重新导入这份 PUB，或从包含正文的备份恢复后再试。')+'</p>',book,anchorEl,'',popupOpts);
    return;
  }
  await showLinkPopover(title,(notice||'')+extract.html,book,anchorEl,'',popupOpts);
}
async function openDocInPopover(book,doc,anchorEl,anchor='',notice=''){
  await showLinkPopover(doc.title||t('文章章节'),(notice||'')+doc.html,book,anchorEl,anchor);
}
async function routeBibleChapterLink(href,anchorEl){
  const m=String(href||'').match(/^jwpub:\/\/c\/([A-Za-z0-9_-]+):(\d+)\/(\d+):(\d+)(?:-(\d+):(\d+))?(?:\$p\/([A-Za-z0-9_-]+):(\d+)\/([^#?]*))?/i);
  if(!m)return false;
  const docId=String(m[2]),chapter=Number(m[3]),verse=Number(m[4]);
  const noteDocId=Number(m[8]||0),notePars=String(m[9]||'');
  // `$p/...` alternatives point at the study note for this verse. Prefer that
  // imported note document over simply opening the Bible chapter.
  if(noteDocId){
    const noteHits=await findDocsByMeps(noteDocId);
    if(noteHits.length){
      const metas=await allBooks(),metaById=new Map(metas.map(x=>[String(x.id),x]));
      const sourceLang=Number(currentBook&&currentBook.lang)||0;
      const allowed=[...noteHits].sort((a,b)=>{
        const aSame=String(a.bookId)===String(currentBook?.id)||Number((metaById.get(String(a.bookId))||{}).lang)===sourceLang;
        const bSame=String(b.bookId)===String(currentBook?.id)||Number((metaById.get(String(b.bookId))||{}).lang)===sourceLang;
        return (aSame?0:1)-(bSame?0:1);
      });
      for(const preferred of allowed){
        const full=await loadBook(preferred.bookId);
        const target=full&&(full.docs||[]).find(d=>normMepsId(d.mepsId)===normMepsId(noteDocId));
        if(full&&target){
          const first=Number((notePars.match(/^(\d+)/)||[])[1]||0);
          const targetLang=Number((metaById.get(String(preferred.bookId))||full).lang)||0;
          await openDocInPopover(full,target,anchorEl,first?`p${first}`:'',languageFallbackNotice(sourceLang,targetLang));
          return true;
        }
      }
    }
  }
  const data=currentBook&&currentBook.bibleData||null;
  let bookNum=data&&data.docBooks?Number(data.docBooks[docId]||0):0;
  let bookId=currentBibleId||(data&&currentBook?currentBook.id:null);
  if(!bookNum){
    const bibleTarget=await findBibleBookDocTarget(Number(docId));
    if(bibleTarget){bookNum=bibleTarget.bookNum;bookId=bibleTarget.bookId}
  }
  if(!bookNum){
    const hits=await findDocsByMeps(Number(docId));
    const hit=hits.find(h=>String(h.bookId)===String(bookId))||hits.find(h=>h.bookId===currentBook?.id)||hits[0];
    if(hit){bookNum=Number(hit.chapterNumber||0);bookId=hit.bookId}
  }
  if(!bookNum||!bookId)return false;
  await openBibleChapterReader(bookId,bookNum,chapter,verse,readerSessionTab||readerOriginSection||primarySection||'bible');
  return true;
}
async function routeCommentaryLink(href,anchorEl){
 const nums=(String(href).match(/\d+/g)||[]).map(Number),books=await allBooks();
 const sourceLang=Number(currentBook&&currentBook.lang)||0;
 const sameLang=m=>String(m.id)===String(currentBook?.id)||!sourceLang||Number(m.lang)===sourceLang;
 const ordered=[...books].sort((a,b)=>(sameLang(a)?0:1)-(sameLang(b)?0:1));
 for(const m of ordered){
  if(!m.hasCommentaries||!sameLang(m))continue;
  const aux=await getBookAux(m.id,m.gen);const rows=(aux&&aux.commentaries)||[];if(!rows.length)continue;
  let found=rows.find(x=>nums.includes(Number(x.id))||nums.includes(Number(x.commentaryMepsDocumentId)));
  if(!found&&rows.length===1)found=rows[0];
  if(found){await showLinkPopover(found.label||t('研究注释'),languageFallbackNotice(sourceLang,m.lang)+(found.html||'<p>'+t('这条注释没有可显示的正文。')+'</p>'),{...m,...(aux||{})},anchorEl);return;}
 }
 for(const m of ordered){
  if(!m.hasExtracts)continue;
  const hit=(m.extractLinks||[]).find(x=>String(x.link||'').toLowerCase()===String(href).toLowerCase());
  if(!hit)continue;
  const aux=await getBookAux(m.id,m.gen)||{};
  const ex=(aux.extracts||[]).find(x=>String(x.id)===String(hit.id));
  if(ex){await openExtractInReader({...m,...aux},ex,anchorEl,languageFallbackNotice(sourceLang,m.lang));return;}
 }
 say('本地没有对应的研究注释',`链接：${href}\n\n已检查本机导入出版物中的 ParagraphCommentary、VerseCommentary 和 Extract 数据，但没有找到能够可靠匹配的注释。没有尝试联网。若你能提供包含这条链接的 PUB 样本，可以进一步确认它的具体地址结构。`);
}
async function routeJwpubLink(href,anchorEl){
  href=normalizePubHref(href);
  const pub=parsePublicationLink(href);
  if(pub){await openPublicationReference(href,anchorEl);return}
  const bible=parseBibleLink(href);
  if(bible){
    const books=await allBooks();
    const versions=orderedBibles(books);
    const selected=versions.find(v=>v.id===currentBibleId)||(currentBook&&currentBook.bibleData?versions.find(v=>v.id===currentBook.id):null);
    if(!versions.length){
      for(const m of books){
        if(!m.hasExtracts)continue;
        const hit=(m.extractLinks||[]).find(x=>String(normalizePubHref(x.link)).toLowerCase()===String(href||'').toLowerCase());
        if(!hit)continue;
        const full=await loadBook(m.id);
        const extract=full&&(full.extracts||[]).find(x=>String(x.id)===String(hit.id));
        if(extract){await openExtractInReader(full,extract,anchorEl);return;}
      }
      const info=currentBook?.databaseInfo||{};
      const ref=`${bible.book}:${bible.chapter}:${bible.verse}${bible.endChapter!==bible.chapter?`–${bible.endChapter}:${bible.endVerse}`:bible.endVerse!==bible.verse?`–${bible.endVerse}`:''}`;
      const hasLinkInfo=(info.bibleLinkRows||0)>0;
      const detail=hasLinkInfo
        ?`\n\n当前这本出版物的 SQLite 已经包含 ${info.bibleLinkRows} 条圣经链接${info.bibleCitationRows?`，以及 ${info.bibleCitationRows} 条 BibleCitation 记录`:''}。链接地址本身已经足以识别经文位置。`
        :`\n\n当前出版物没有检测到独立的 BibleVerse 正文表。`;
      const verseText=info.bibleVerseRows
        ?`检测到 BibleVerse 表 ${info.bibleVerseRows} 条，但暂未找到可用的对应版本索引。`
        :`但没有检测到 BibleVerse 正文数据（${info.bibleVerseRows||0} 条）。`;
      say('已识别经文位置，但本地没有经文正文',`圣经版本：${bible.version}\n经文位置：${ref}${detail}\n\n这里缺少的不是链接，而是可显示的经文正文。PUB 的普通出版物可以保存经文链接和引用关系；圣经正文通常保存在圣经 PUB 自己的 BibleVerse / BibleChapter 表中。\n\n数据库检查：Hyperlink ${info.hyperlinkRows||0} 条；圣经链接 ${info.bibleLinkRows||0} 条；BibleCitation ${info.bibleCitationRows||0} 条；BibleVerse ${info.bibleVerseRows||0} 条；BibleChapter ${info.bibleChapterRows||0} 条。\n${verseText}\n\n导入一次相应语言/版本的圣经 PUB 后，其他出版物的经文链接就可以共用这份本地经文数据。`);
      return;
    }
    const readingBible=!!(currentBook&&(currentBook.bibleData||currentBook.hasBible));
    const chosen=readingBible?(currentBook&&currentBook.bibleData?[currentBook]:(selected?[selected]:versions)):(versions);
    await openBibleVersions(chosen,bible,href,anchorEl);return;
  }
  if(/^jwpub:\/\/c\//i.test(String(href||''))){if(!(await routeBibleChapterLink(href,anchorEl))){await routeCommentaryLink(href,anchorEl)}return;}
  say('暂不支持的内部链接','当前版本无法识别这个 PUB 内部链接格式。已支持出版物段落链接和圣经经文链接；研究注释会在本地出版物包含对应 Commentary 数据时尝试预览。');
}
function verseLocationForId(data,id){
  if(!data||!data.chapters)return null;
  for(const [key,ch] of Object.entries(data.chapters)){
    const first=Number(ch.firstVerseId),last=Number(ch.lastVerseId);
    if(id>=first&&id<=last){const p=key.split(':'),label=Number(String(data.verseRows?.[data.verseIndex?.[id]]?.label||'').trim());return {b:Number(p[0]),c:Number(p[1]),v:label||(id-Number(ch.firstNumberedVerseId||first)+1)}}
  }
  return null;
}
function verseContext(el){
  if(!el||!currentBook||currentIndex<0)return null;
  const d=currentBook.docs[currentIndex];if(!d)return null;
  const data=currentBook.bibleData||{};
  const docMatch=String(d.id||'').match(/^bible-(\d+)-(\d+)$/);
  let bookNum=docMatch?Number(docMatch[1]):Number(d.chapterNumber||0),chapter=docMatch?Number(docMatch[2]):0,verseNum=0;
  const vm=String(el.id||'').match(/^v(\d+)-(\d+)-(\d+)/);
  if(vm){bookNum=Number(vm[1]);chapter=Number(vm[2]);verseNum=Number(vm[3])}
  else{
    const id=Number(el.getAttribute('data-bible-verse')||0);
    if(id){const loc=verseLocationForId(data,id);if(loc){bookNum=loc.b;chapter=loc.c;verseNum=loc.v}}
  }
  if(!bookNum||!chapter||!verseNum)return null;
  const ri=data.verseIndex?.[Number(el.getAttribute('data-bible-verse')||0)],row=ri===undefined?null:data.verseRows?.[ri];
  const label=String(verseNum);
  return {el,d,data,bookNum,chapter,verseNum,label,key:`${bookNum}:${chapter}:${verseNum}`};
}
function showVerseActions(el,rect){
  const region=el&&el.closest?el.closest('.bible-verse,.v')||el:el;
  const ctx=verseContext(region);if(!ctx)return;
  showContextActions({kind:'verse',ctx},rect||region.getBoundingClientRect());
}
function blockActionCandidate(target){
  const el=target&&target.nodeType===1?target:(target&&target.parentElement);
  if(!el||!el.closest)return null;
  if(el.closest('a,button,input,textarea,select,.hl,.hl-note-mark,.fn,.m[data-mid]'))return null;
  const block=el.closest('p,li,blockquote,h1,h2,h3,h4,[data-pid]');
  if(!block||!hlRoot().contains(block))return null;
  if(block.closest('.v,.bible-verse'))return null;
  if(block.matches('[data-pid],li,blockquote')&&block.querySelector('p,li,blockquote,[data-pid]'))return null;
  if(!visibleText(block).trim())return null;
  return block;
}
function pointInsideRect(x,y,rect,pad){
  if(!rect)return false;
  const p=Number.isFinite(pad)?pad:1;
  return x>=rect.left-p&&x<=rect.right+p&&y>=rect.top-p&&y<=rect.bottom+p;
}
function caretRangeAtPoint(x,y){
  try{
    if(document.caretRangeFromPoint)return document.caretRangeFromPoint(x,y);
    if(document.caretPositionFromPoint){
      const pos=document.caretPositionFromPoint(x,y);
      if(pos&&pos.offsetNode){const range=document.createRange();range.setStart(pos.offsetNode,pos.offset);range.collapse(true);return range}
    }
  }catch(e){}
  return null;
}
function elementFromNode(node){return node&&(node.nodeType===1?node:node.parentElement)||null}
function nearestVerseIn(host,y){
  let best=null,bestDistance=Infinity;
  for(const verse of host.querySelectorAll('.v,.bible-verse')){
    for(const rect of verse.getClientRects()){
      if(!rect.width&&!rect.height)continue;
      const distance=y<rect.top?rect.top-y:(y>rect.bottom?y-rect.bottom:0);
      if(distance<bestDistance){bestDistance=distance;best=verse}
    }
  }
  return best;
}
function verseAtPoint(x,y){
  const range=caretRangeAtPoint(x,y);
  const el=elementFromNode(range&&range.startContainer);
  const verse=el&&el.closest?el.closest('.v,.bible-verse'):null;
  if(verse&&verseContext(verse)){
    const host=verse.closest('p,li,blockquote,.bible-verse')||verse;
    // The caret can sit on a verse while the finger is in the blank part of
    // its line; accept the verse as long as the tap is inside its block box.
    if(pointInsideRect(x,y,host.getBoundingClientRect(),3))return verse;
  }
  const host=el&&el.closest?el.closest('p,li,blockquote,.bible-verse'):null;
  if(host&&pointInsideRect(x,y,host.getBoundingClientRect(),3)){
    const near=nearestVerseIn(host,y);
    if(near&&verseContext(near))return near;
  }
  return null;
}
function blockAtPoint(x,y){
  const range=caretRangeAtPoint(x,y);
  const el=elementFromNode(range&&range.startContainer);
  if(!el||!el.closest)return null;
  const verse=el.closest('.v,.bible-verse');
  if(verse&&verseContext(verse))return null;
  const block=el.closest('p,li,blockquote,h1,h2,h3,h4,[data-pid]');
  if(!block||!hlRoot().contains(block))return null;
  if(!pointInsideRect(x,y,block.getBoundingClientRect(),3))return null;
  if(block.closest('a,.hl,.hl-note-mark,.fn,.m[data-mid],.vl'))return null;
  if(!visibleText(block).trim())return null;
  if(block.matches('[data-pid],li,blockquote')&&block.querySelector('p,li,blockquote,[data-pid]'))return null;
  return block;
}
function regionAtPoint(e){
  const x=Number(e.clientX),y=Number(e.clientY);
  if(Number.isFinite(x)&&Number.isFinite(y)&&(x||y)){
    const verse=verseAtPoint(x,y);
    if(verse)return {kind:'verse',el:verse};
    const block=blockAtPoint(x,y);
    return block?{kind:'block',el:block}:null;
  }
  const verse=e.target&&e.target.closest?e.target.closest('.bible-verse,.v'):null;
  if(verse&&verseContext(verse))return {kind:'verse',el:verse};
  const block=blockActionCandidate(e.target);
  return block?{kind:'block',el:block}:null;
}
function pointLineRect(x,y,fallback){
  try{
    let range=null;
    if(document.caretRangeFromPoint)range=document.caretRangeFromPoint(x,y);
    else if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);if(p){range=document.createRange();range.setStart(p.offsetNode,p.offset);range.collapse(true)}}
    if(range){
      const rects=[...range.getClientRects()].filter(r=>r.width||r.height);
      const r=rects[0]||range.getBoundingClientRect();
      if(r&&(r.width||r.height))return {top:r.top,bottom:r.bottom,left:r.left,width:r.width,height:r.height,lineHeight:r.height||24};
    }
  }catch(e){}
  return fallback;
}
function showBlockActions(el,rect){
  if(!el)return;
  const fallback=el.getBoundingClientRect();
  showContextActions({kind:'block',el},rect||{top:fallback.top,bottom:Math.min(fallback.bottom,fallback.top+32),left:fallback.left,width:fallback.width,height:Math.min(fallback.height,32),lineHeight:24});
}
function blockText(block){
  try{
    const clone=block.cloneNode(true);
    clone.querySelectorAll('rt,rp,.tt,.fn,.m,.vl,.cl,.fcc,.hl-note-mark').forEach(n=>n.remove());
    return String(clone.innerText||clone.textContent||'').replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim();
  }catch(e){return visibleText(block).replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim()}
}
function plainTextFromHtml(html){
  try{
    const d=document.createElement('div');d.innerHTML=String(html||'');
    d.querySelectorAll('rt,rp,script,style').forEach(n=>n.remove());
    return String(d.innerText||d.textContent||'').replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim();
  }catch(e){return stripHtmlText(html)}
}
async function localBibleRange(range,state){
  if(!range)return null;
  state=state||{loaded:new Map(),metas:null};
  const tryBook=async b=>{
    if(!b||!b.bibleData)return null;
    try{const r=await bibleRangeHtml(b,range);if(r.html)return {book:b,html:r.html}}catch(e){}
    return null;
  };
  const currentHit=await tryBook(currentBook);
  if(currentHit)return currentHit;
  if(!state.metas){
    const saved=currentBibleId||(()=>{try{return localStorage.getItem('offlineLibraryBibleId')}catch(e){return ''}})();
    state.metas=orderedBibles(await allBooks());
    state.metas.sort((a,b)=>{
      const rank=x=>String(x.id)===String(saved)?0:(currentBook&&Number(x.lang)===Number(currentBook.lang)?1:2);
      return rank(a)-rank(b);
    });
  }
  for(const m of state.metas){
    if(currentBook&&String(m.id)===String(currentBook.id))continue;
    const key=String(m.id);
    let full=state.loaded.get(key);
    if(full===undefined){full=await loadBookAuxOnly(m.id);state.loaded.set(key,full)}
    const hit=await tryBook(full);
    if(hit)return hit;
  }
  return null;
}
function publicationPreviewHtml(raw,paragraph){
  const box=document.createElement('div');box.innerHTML=String(raw||'');
  let target=null;
  const p=Number(paragraph)||0;
  if(p){
    try{target=box.querySelector('[data-pid="'+p+'"],[data-pnum="'+p+'"],[id="p'+p+'"],[id="par'+p+'"]')}catch(e){}
  }
  if(!target)target=[...box.querySelectorAll('p,li,blockquote,h1,h2,h3,h4')].find(el=>visibleText(el).trim())||null;
  if(!target)target=[...box.querySelectorAll('[data-pid]')].find(el=>visibleText(el).trim())||null;
  if(!target)return '';
  if(target.matches&&target.matches('[data-pid]')){
    const blocks=[...target.querySelectorAll('p,li,blockquote')];
    if(blocks.length===1)target=blocks[0];
  }
  const clone=target.cloneNode(true);
  // An article preview is a compact excerpt: remove media and marker glyphs.
  // Keep ruby annotations so pinyin follows the pronunciation toggle.
  clone.querySelectorAll('script,style,img,picture,video,audio,figure,iframe,object,embed,.fn,.m,.vl,.cl,.tt').forEach(n=>n.remove());
  // Use the reader's own text styling instead of the source article's inline
  // colours and classes, so an article preview matches a verse link.
  [clone,...clone.querySelectorAll('*')].forEach(n=>{n.removeAttribute('style');n.removeAttribute('class')});
  if(visibleText(clone).length>800){
    let total=0;
    for(const child of [...clone.children]){
      const length=visibleText(child).length;
      if(total+length>800){child.remove();continue}
      total+=length;
    }
  }
  let html='';
  try{html=cleanHtml(clone.outerHTML,{}).body||''}catch(e){html=''}
  if(!html)return '';
  const probe=document.createElement('div');probe.innerHTML=html;
  return visibleText(probe).trim()?html:'';
}
const publicationLangCache=new Map();
async function publicationBookLang(bookId){
  const key=String(bookId);
  if(publicationLangCache.has(key))return publicationLangCache.get(key);
  let lang='';
  try{const meta=await getBookMeta(bookId);lang=String(meta&&meta.lang!==undefined?meta.lang:'')}catch(e){}
  publicationLangCache.set(key,lang);
  return lang;
}
function uiContentLangHint(){
  // Only the indexes that are unambiguous in this build; other UI languages
  // fall back to the current publication's language.
  const map={en:0,zh:279,ja:7};
  return map[uiLang]===undefined?null:map[uiLang];
}
async function preferredPublicationHit(hits){
  if(!hits||!hits.length)return null;
  const currentLang=currentBook&&currentBook.lang!==undefined?String(currentBook.lang):'';
  const uiHint=uiContentLangHint();
  let best=hits[0],bestScore=-Infinity;
  for(const hit of hits){
    const lang=await publicationBookLang(hit.bookId);
    let score=0;
    if(currentBook&&String(hit.bookId)===String(currentBook.id))score+=100;
    if(currentLang&&lang===currentLang)score+=40;
    if(contentLangFilter!=='all'&&lang===String(contentLangFilter))score+=20;
    if(uiHint!==null&&lang===String(uiHint))score+=10;
    if(score>bestScore){bestScore=score;best=hit}
  }
  return best;
}
async function publicationLinkPreview(href){
  const pub=parsePublicationLink(href);if(!pub)return null;
  for(const target of (pub.targets&&pub.targets.length?pub.targets:[pub])){
    const hits=await findDocsByMeps(target.docId);if(!hits.length)continue;
    const hit=await preferredPublicationHit(hits);if(!hit)continue;
    const doc=await getBookDoc(hit.bookId,hit.docId);if(!doc)continue;
    const html=publicationPreviewHtml(doc.html,target.paragraph);
    if(html)return {label:doc.title||'',html,text:plainTextFromHtml(html).slice(0,500)};
  }
  return null;
}
function linkLabelText(a,fallback){
  try{
    const clone=a&&a.cloneNode?a.cloneNode(true):null;
    if(clone){
      clone.querySelectorAll('rt,rp,.tt').forEach(n=>n.remove());
      const text=String(clone.textContent||'').replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim();
      if(text)return text;
    }
  }catch(e){}
  return String(fallback||'').replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim();
}
async function publicationLinkSection(a,bibleState){
  const href=String(a&&a.dataset&&a.dataset.jwlink||'');
  if(!href)return null;
  const fallback=linkLabelText(a,t('相关链接'))||t('相关链接');
  const bible=parseBibleLink(href);
  if(bible){
    const range={book:bible.book,chapter:bible.chapter,verse:bible.verse,endChapter:bible.endChapter,endVerse:bible.endVerse};
    const found=await localBibleRange(range,bibleState);
    const labelData=found?found.book.bibleData:null;
    const label=labelData?bibleRangeTitle(labelData,range):`${bible.book}:${bible.chapter}:${bible.verse}`;
    return {label:t('相关经文'),html:`<p class="xref-ref"><a data-jwlink="${href.replace(/"/g,'&quot;')}">${safeText(label)}</a></p>${found?found.html:'<p class="xref-empty">'+t('本地没有对应经文正文')+'</p>'}`};
  }
  const preview=await publicationLinkPreview(href);
  if(preview){
    // The link name is plain text; pinyin belongs only in the excerpt body and
    // must follow the pronunciation toggle.
    const linkName=plainTextFromHtml(preview.label||'').replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim()||fallback;
    return {label:t('相关链接'),html:`<div class="verse-ref-target"><p class="xref-ref"><a data-jwlink="${href.replace(/"/g,'&quot;')}">${safeText(linkName)}</a></p><div class="linked-article-preview">${preview.html}</div></div>`};
  }
  return {label:t('相关链接'),html:`<p class="xref-ref"><a data-jwlink="${href.replace(/"/g,'&quot;')}">${safeText(fallback)}</a></p>`};
}
function bibleBookNumForNode(el){
  try{
    const v=el&&el.closest?el.closest('.v'):null;
    if(v){const ctx=verseContext(v);if(ctx)return ctx.bookNum}
    const d=currentBook&&currentBook.docs&&currentBook.docs[currentIndex];
    const m=String(d&&d.id||'').match(/^bible-(\d+)-(\d+)$/);
    if(m)return Number(m[1]);
  }catch(e){}
  return 0;
}
async function showBlockInfo(block){
  if(!block)return;
  try{
    const scope=hlRoot()||$('article');const sections=[];const seenFn=new Set(),bibleState={loaded:new Map(),metas:null};
    [...block.querySelectorAll('.fn[data-fnid]')].slice(0,20).forEach(node=>{
      const id=String(node.getAttribute('data-fnid')||'');if(!id||seenFn.has(id))return;seenFn.add(id);
      const target=footnoteTarget(scope,id)||footnoteTarget($('article'),id);
      sections.push({label:(node.dataset.fnSymbol||'*')+' '+t('脚注'),html:target?footnoteBodyHtml(target):'<p class="xref-empty">'+t('没有找到对应的脚注正文。')+'</p>'});
    });
    // Bible cross-reference markers ("串珠") keep their references in the
    // publication's block index, not in an anchor. Resolve them here so a
    // paragraph shows the same reference label plus verse text as a verse does.
    const data=currentBook&&currentBook.bibleData||null;
    const bookNum=bibleBookNumForNode(block);
    const seenXref=new Set();
    for(const node of [...block.querySelectorAll('.m[data-mid]')].slice(0,8)){
      const mid=String(node.getAttribute('data-mid')||'');if(!mid||seenXref.has(mid))continue;seenXref.add(mid);
      const refs=bookNum&&data?(data.blockRefs||{})[`${bookNum}:${mid}`]||[]:[];
      if(!refs.length)continue;
      let out='';
      for(const item of refs.slice(0,8)){
        const range={book:item.b,chapter:item.c,verse:item.v,endChapter:Number(item.ec)||item.c,endVerse:Number(item.e)||item.v};
        const found=await localBibleRange(range,bibleState);
        const label=xrefLabel({data:found?found.book.bibleData:data||{}},item);
        out+=`<div class="verse-ref-target"><p class="xref-ref"><a data-jwlink="${String(xrefHref({data:found?found.book.bibleData:data||{}},item)).replace(/"/g,'&quot;')}">${safeText(label)}</a></p>${found?found.html:'<p class="xref-empty">'+t('本地没有对应经文正文')+'</p>'}</div>`;
      }
      sections.push({label:t('相关经文'),html:out});
    }
    const links=[...block.querySelectorAll('a[data-jwlink]')].slice(0,12),seenLinks=new Set();
    for(const a of links){
      if(a.closest('.m[data-mid],.fn'))continue;
      const href=String(a.dataset.jwlink||'');if(!href||seenLinks.has(href))continue;seenLinks.add(href);
      const section=await publicationLinkSection(a,bibleState);
      if(section)sections.push(section);
    }
    [...block.querySelectorAll('a[data-external-link]')].slice(0,5).forEach(a=>{
      const label=linkLabelText(a,t('相关链接'));
      sections.push({label:t('相关链接'),html:`<p>${safeText(label)}</p><p class="xref-empty">${t('这是一个外部网页链接，当前离线阅读器不会尝试联网打开。')}</p>`});
    });
    if(!sections.length){say(t('段落信息'),t('这一段没有可显示的脚注或相关链接。'));return}
    const html=sections.map(x=>`<div class="verse-ref-section"><p class="verse-ref-label">${safeText(x.label)}</p>${x.html}</div>`).join('');
    await showLinkPopover(t('段落信息'),html,currentBook,block);
  }catch(e){
    try{console.warn('paragraph info failed',e)}catch(_e){}
    say(t('段落信息'),t('无法读取这一段的信息。'));
  }
}
async function doBlockAction(act){
  const state=blockActionState;if(!state||!state.el)return;
  const block=state.el,quote=blockText(block);
  hideContextActions();
  if(act==='info'){await showBlockInfo(block);return}
  if(act==='copy'){
    if(!quote)return;
    try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(quote);else await copyText(quote);say(t('已复制'),quote.slice(0,160))}catch(e){say(t('复制失败'),e.message||String(e))}
    return;
  }
  if(act==='note'){
    if(!quote)return;
    const d=currentBook&&currentBook.docs[currentIndex];if(!d)return;
    const pid=block.getAttribute('data-pid')||'',blockIndex=hlBlocks(hlRoot()).indexOf(block);
    const h={id:'block-note-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),bookId:String(currentBook.id),docId:String(d.id),seriesKey:seriesKeyFor(currentBook),mepsDocId:String(d.mepsId||''),pid,blockIndex,quote:quote.slice(0,600),color:'#ffe58a',noteId:null,createdAt:Date.now()};
    const note={id:noteIdForNew(),title:quote.slice(0,40)||t('段落笔记'),text:'',tagIds:[],bookId:String(currentBook.id),docId:String(d.id),seriesKey:seriesKeyFor(currentBook),mepsDocId:String(d.mepsId||''),pid,blockIndex,kind:'paragraph',createdAt:Date.now(),updatedAt:Date.now()};
    await openAnnotationEditor(h,note,true,{virtual:true,data:{kind:'paragraph',pid}});
  }
}
function xrefLabel(ctx,item){
  if(!item)return '';
  const end=Number(item.ec)!==Number(item.c)?`–${item.ec}:${item.e}`:Number(item.e)!==Number(item.v)?`–${item.e}`:'';
  return `${chineseBibleBookName(ctx.data,item.b)} ${item.c}:${item.v}${end}`;
}
function xrefHref(ctx,item){
  const ver=String((ctx.data.versionCodes||[])[0]||'NWTR');
  const end=Number(item.ec)!==Number(item.c)||Number(item.e)!==Number(item.v)?`-${item.b}:${Number(item.ec)||item.c}:${item.e}`:'';
  return `jwpub://b/${ver}/${item.b}:${item.c}:${item.v}${end}`;
}
async function showRefItems(ctx,items,emptyMessage){
  if(!items||!items.length){say(t('相关经文'),emptyMessage||t('没有找到相关经文。'));return}
  let html='';
  for(const item of items.slice(0,40)){
    const range={book:item.b,chapter:item.c,verse:item.v,endChapter:Number(item.ec)||item.c,endVerse:item.e};
    let body='';
    try{const r=await bibleRangeHtml(currentBook,range);body=r.html||''}catch(e){}
    html+=`<div class="xref-block"><h3>${safeText(xrefLabel(ctx,item))}</h3>${body||'<p>'+t('没有经文正文')+'</p>'}</div>`;
  }
  await showLinkPopover(t('相关经文'),html,currentBook,ctx.el);
}
function verseTextForCopy(el){
  try{const clone=el.cloneNode(true);clone.querySelectorAll('rt,rp,sup,.tt,.cl,.m,.fn,.vl,.fcc').forEach(n=>n.remove());return String(clone.innerText||clone.textContent||'').replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim()}catch(e){return String(el.textContent||'').trim()}
}
async function showBibleRefList(items,anchor,title){
  const data=currentBook&&currentBook.bibleData||{};
  if(!items||!items.length){say(title,t('没有找到相关经文。'));return}
  const shown=items.slice(0,20);
  const out=shown.map((item,i)=>{
    const label=xrefLabel({data},item),href=xrefHref({data},item);
    return `<div class="xref-entry"><p class="xref-ref"><a href="${String(href).replace(/"/g,'&quot;')}">${safeText(label)}</a></p><div class="xref-content" data-xref-index="${i}"><p class="xref-empty">${t('正在读取…')}</p></div></div>`;
  });
  if(items.length>20)out.push(`<p class="xref-more">${t('仅显示前 20 条')}</p>`);
  await showLinkPopover(title,out.join(''),currentBook,anchor);
  const body=linkPanelBodyEl();
  for(let i=0;i<shown.length;i++){
    if(!body||!linkPanelOpen())return;
    const item=shown[i];
    const range={book:item.b,chapter:item.c,verse:item.v,endChapter:Number(item.ec)||item.c,endVerse:Number(item.e)||item.v};
    let content='';
    try{const r=await bibleRangeHtml(currentBook,range);content=r.html||''}catch(e){}
    const box=body.querySelector('[data-xref-index="'+i+'"]');
    if(box){box.innerHTML=content||`<p class="xref-empty">${t('没有找到经文正文。')}</p>`;applyPinyinDom(box)}
    await new Promise(r=>setTimeout(r,0));
  }
}
async function showBibleBlockRefs(el,mid){
  const data=currentBook&&currentBook.bibleData||{};
  const v=el.closest&&el.closest('.v');
  let bookNum=0;
  if(v){const ctx=verseContext(v);if(ctx)bookNum=ctx.bookNum}
  if(!bookNum){const d=currentBook&&currentBook.docs&&currentBook.docs[currentIndex];const m=String(d&&d.id||'').match(/^bible-(\d+)-(\d+)$/);if(m)bookNum=Number(m[1])}
  if(!bookNum){say(t('相关经文'),t('无法确定当前经卷。'));return}
  const refs=(data.blockRefs||{})[`${bookNum}:${String(mid)}`];
  if(!refs){say(t('相关经文'),t('这份圣经没有串珠索引，请重新导入该圣经 PUB。'));return}
  await showBibleRefList(refs,el,t('相关经文'));
}
async function showBibleVerseRefs(el){
  const region=el&&el.closest?el.closest('.bible-verse,.v')||el:el;
  const ctx=verseContext(region);
  if(!ctx){
    // Some editions wrap verse numbers differently. Never leave the tap with
    // no response: fall back to the paragraph information panel instead.
    await showBlockInfo(el&&el.closest?el.closest('p,li,blockquote,[data-pid]')||el:el);
    return;
  }
  const scope=region.closest('.publication-content')||$('article');
  const sections=[],fillers=[],seenFn=new Set(),seenLinks=new Set();
  const bibleState={loaded:new Map(),metas:null};
  for(const node of region.querySelectorAll('.fn[data-fnid],.m[data-mid]')){
    if(node.classList.contains('fn')){
      const id=String(node.getAttribute('data-fnid')||'');if(!id||seenFn.has(id))continue;seenFn.add(id);
      const target=footnoteTarget(scope,id);
      sections.push({label:(node.dataset.fnSymbol||'*')+' '+t('脚注'),html:target?footnoteBodyHtml(target):'<p class="xref-empty">'+t('没有找到对应的脚注正文。')+'</p>'});
    }else{
      const mid=String(node.getAttribute('data-mid')||'');
      const refs=((ctx.data.blockRefs||{})[`${ctx.bookNum}:${mid}`]||[]);
      if(!refs.length)continue;
      const label=(node.dataset.fnSymbol||String(node.textContent||'').trim())+' '+t('相关经文');
      const idx=sections.length;sections.push({label,html:`<div data-verse-ref="${idx}"><p class="xref-empty">${t('正在读取…')}</p></div>`});
      fillers.push({idx,refs});
    }
  }
  const verseRefs=(ctx.data.crossRefs||{})[ctx.key]||[];
  if(verseRefs.length){const idx=sections.length;sections.push({label:t('整节经文')+' '+t('相关经文'),html:`<div data-verse-ref="${idx}"><p class="xref-empty">${t('正在读取…')}</p></div>`});fillers.push({idx,refs:verseRefs});}
  // Links written directly in this verse: Bible references and cited articles.
  for(const a of [...region.querySelectorAll('a[data-jwlink]')].slice(0,12)){
    if(a.closest('.m[data-mid],.fn'))continue;
    const href=String(a.dataset.jwlink||'');if(!href||seenLinks.has(href))continue;seenLinks.add(href);
    const section=await publicationLinkSection(a,bibleState);
    if(section)sections.push(section);
  }
  for(const a of [...region.querySelectorAll('a[data-external-link]')].slice(0,5)){
    const label=linkLabelText(a,t('相关链接'));
    sections.push({label:t('相关链接'),html:`<p>${safeText(label)}</p><p class="xref-empty">${t('这是一个外部网页链接，当前离线阅读器不会尝试联网打开。')}</p>`});
  }
  if(!sections.length){say(t('经文信息'),t('这一节没有可显示的脚注或相关经文。'));return}
  const data=ctx.data;
  const html=sections.map(x=>`<div class="verse-ref-section"><p class="verse-ref-label">${safeText(x.label)}</p>${x.html}</div>`).join('');
  await showLinkPopover(t('经文信息'),html,currentBook,region);
  const body=linkPanelBodyEl();
  for(const fill of fillers){
    if(!body||!linkPanelOpen())return;
    let out='';
    for(const item of fill.refs.slice(0,20)){
      const range={book:item.b,chapter:item.c,verse:item.v,endChapter:Number(item.ec)||item.c,endVerse:Number(item.e)||item.v};
      let content='';try{const r=await bibleRangeHtml(currentBook,range);content=r.html||''}catch(e){}
      // These links are inserted after showLinkPopover has sanitised the panel,
      // so write data-jwlink directly to keep them routed by the offline reader.
      out+=`<div class="verse-ref-target"><p><a data-jwlink="${String(xrefHref({data},item)).replace(/"/g,'&quot;')}" role="link" style="cursor:pointer">${safeText(xrefLabel({data},item))}</a></p>${content||'<p class="xref-empty">'+t('没有找到经文正文。')+'</p>'}</div>`;
      await new Promise(r=>setTimeout(r,0));
    }
    if(fill.refs.length>20)out+=`<p class="xref-more">${t('仅显示前 20 条')}</p>`;
    const box=body.querySelector('[data-verse-ref="'+fill.idx+'"]');if(box){box.innerHTML=out||`<p class="xref-empty">${t('没有找到相关经文。')}</p>`;applyPinyinDom(box)}
  }
}
async function doVerseAction(act){
  const ctx=verseActionState;if(!ctx)return;hideVerseActions();
  if(act==='xref'){
    if(!ctx.data.crossRefs&&!ctx.data.blockRefs){say(t('相关经文'),t('这份圣经是在旧版本导入的，没有串珠索引。请重新导入该圣经 PUB。'));return}
    await showBibleVerseRefs(ctx.el);
    return;
  }
  if(act==='note'){
    const label=`${chineseBibleBookName(ctx.data,ctx.bookNum)} ${ctx.chapter}:${ctx.label||''}`.trim();
    const quote=verseTextForCopy(ctx.el);
    const h={id:'verse-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),bookId:String(currentBook.id),docId:String(ctx.d.id),seriesKey:seriesKeyFor(currentBook),mepsDocId:String(ctx.d.mepsId||''),pid:'',quote,color:'#ffe58a',noteId:null,createdAt:Date.now()};
    const note={id:noteIdForNew(),title:label,text:'',tagIds:[],bookId:String(currentBook.id),docId:String(ctx.d.id),verseId:String(ctx.verseNum),bibleBook:ctx.bookNum,bibleChapter:ctx.chapter,kind:'verse',createdAt:Date.now(),updatedAt:Date.now()};
    await openAnnotationEditor(h,note,true,{virtual:true,data:{kind:'verse',verseId:String(ctx.verseNum),bibleBook:ctx.bookNum,bibleChapter:ctx.chapter}});return;
  }
  if(act==='copy'){
    const text=verseTextForCopy(ctx.el);
    try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);else await copyText(text);say(t('已复制'),t('经文已复制。'))}catch(e){say(t('复制失败'),e.message||String(e))}
  }
}
async function handleLinkedContentClick(e){
  const a=e.target.closest('a');if(!a)return;
  hideVerseActions();
  if(a.dataset.jwlink){e.preventDefault();e.stopPropagation();await routeJwpubLink(a.dataset.jwlink,a);return;}
  if(a.dataset.externalLink){e.preventDefault();say('离线链接不可用','这是一个外部网页链接，当前离线阅读器不会尝试联网打开。');return;}
}
$('article').addEventListener('click',async e=>{
  const fn=e.target.closest&&e.target.closest('.fn[data-fnid]');
  const marker=e.target.closest&&e.target.closest('.m[data-mid]');
  const num=e.target.closest&&e.target.closest('.v .cl');
  if(fn||marker||num)hideVerseActions();
  if(fn){e.preventDefault();e.stopPropagation();await showFootnote(fn);return}
  if(marker){
    e.preventDefault();e.stopPropagation();
    // A "串珠"/margin marker in a non-Bible publication has no book index to
    // resolve; show the surrounding paragraph's information instead of an
    // explanatory dead end.
    if(currentBook&&currentBook.bibleData)await showBibleBlockRefs(marker,marker.getAttribute('data-mid'));
    else await showBlockInfo(marker.closest('p,li,blockquote,[data-pid]')||marker);
    return;
  }
  if(num){e.preventDefault();e.stopPropagation();await showBibleVerseRefs(num);return}
},true);
$('article').addEventListener('click',handleLinkedContentClick);
$('article').addEventListener('click',e=>{
  if(window.getSelection&&!window.getSelection().isCollapsed)return;
  if(e.target.closest&&e.target.closest('a,.hl,.hl-note-mark,.m[data-mid],.fn,.v .cl'))return;
  // When a verse or paragraph is already marked, any inert tap in the article
  // abandons it. The tap must not turn into a new operation target: selecting
  // again takes a fresh tap.
  if(contextActionState){dismissRegionSelection();return}
  const hit=regionAtPoint(e);
  if(!hit)return;
  if(hit.kind==='verse'){showVerseActions(hit.el,pointLineRect(e.clientX,e.clientY,null));return}
  showBlockActions(hit.el,pointLineRect(e.clientX,e.clientY,null));
});
$('article').addEventListener('click',async e=>{const mark=e.target.closest&&e.target.closest('.hl-note-mark');if(mark){const hlId=mark.dataset.hlId,noteId=mark.dataset.noteId;if(!hlId&&!noteId)return;e.preventDefault();e.stopPropagation();if(noteId)await openVerseNote(noteId);else await openHighlightNote(hlId);return}const span=e.target.closest&&e.target.closest('.hl');if(!span)return;e.preventDefault();e.stopPropagation();await showHighlightActions(span,span.dataset.hlId);},true);
['touchstart','wheel','pointerdown'].forEach(ev=>$('readerBody').addEventListener(ev,()=>{readerRestoreToken++;readerRestoreActive=false},{passive:true}));
$('readerBody').addEventListener('scroll',()=>{if($('reader').style.display!=='block')return;if(!currentBook||currentIndex<0)return;if(readerRestoreActive)return;const tab=readerSessionTab||readerOriginSection||readerNavSection||primarySection;if(tab&&sectionViews[tab]){sectionViews[tab].scrollTop=Number($('readerBody').scrollTop||0);sectionViews[tab].pid='';sectionViews[tab].anchorOffset=0;sectionViews[tab].blockIndex=-1;scheduleReaderCacheSave()}if(bibleMode)return;const now=Date.now();if(now-historyWriteAt<1200)return;historyWriteAt=now;const d=currentBook.docs[currentIndex];if(d)recordHistory(currentBook,d,$('readerBody').scrollTop).catch(()=>{})},{passive:true});
const handleLinkPanelClick=async e=>{const fn=e.target.closest&&e.target.closest('.fn[data-fnid]');if(fn){e.preventDefault();e.stopPropagation();await showFootnote(fn);return}await handleLinkedContentClick(e)};
$('linkPopoverBody').addEventListener('click',handleLinkPanelClick);
const _readerSidePanelBody=$('readerSidePanelBody');if(_readerSidePanelBody)_readerSidePanelBody.addEventListener('click',handleLinkPanelClick);
$('linkPopoverClose').onclick=closeLinkPopover;
const _readerSidePanelClose=$('readerSidePanelClose');if(_readerSidePanelClose)_readerSidePanelClose.onclick=closeLinkPopover;
$('annotationsClose').onclick=closeAnnotationsPanel;
$('annotationClose').onclick=closeAnnotationEditor;
$('annotationSave').onclick=saveAnnotation;
$('annotationDelete').onclick=deleteAnnotation;
$('readerSearchBtn').onclick=()=>{const panel=$('readerSearchPanel');if(panel&&panel.classList.contains('show'))closeReaderSearch();else openReaderSearch()};
$('readerSearchClose').onclick=closeReaderSearch;
$('readerSearchRun').onclick=()=>runReaderSearch($('readerSearchInput').value,true);
$('readerSearchInput').addEventListener('input',e=>{
  if(readerSearchTimer)clearTimeout(readerSearchTimer);
  const q=e.target.value;
  readerSearchTimer=setTimeout(()=>{readerSearchTimer=null;runReaderSearch(q,false)},420);
});
$('readerSearchInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();if(readerSearchTimer){clearTimeout(readerSearchTimer);readerSearchTimer=null}runReaderSearch(e.target.value,true)}
  else if(e.key==='Escape'){e.preventDefault();closeReaderSearch()}
});
$('contextActions').addEventListener('mousedown',e=>e.preventDefault());
// Taps inside the bar also fire document-level selectionchange/touchend. Keep
// those handlers from refreshing (and therefore closing) the bar mid-tap.
['pointerdown','mousedown','touchstart'].forEach(ev=>$('contextActions').addEventListener(ev,()=>{contextBarGuardUntil=Date.now()+900},{passive:true}));
$('contextActions').querySelectorAll('[data-context-color]').forEach(btn=>btn.onclick=e=>{
  e.stopPropagation();
  const state=contextActionState;if(!state)return;
  const color=btn.getAttribute('data-context-color');
  if(state.kind==='selection'){
    const range=state.range;hideContextActions();if(range)createHighlightFromRange(range,color);
  }else if(state.kind==='highlight'){
    const id=state.highlightId;hideContextActions();updateHighlightColor(id,color);
  }
});
$('contextActions').querySelectorAll('[data-context-act]').forEach(btn=>btn.onclick=async e=>{
  e.stopPropagation();
  const state=contextActionState;if(!state)return;
  const act=btn.getAttribute('data-context-act');
  if(act==='color'){const bar=$('contextActions');if(bar){const open=bar.classList.toggle('colors-open');btn.setAttribute('aria-expanded',open?'true':'false');if(contextToolbarRect)placeSelectionToolbar(bar,contextToolbarRect)}return}
  if(act==='info'&&state.kind==='verse'){
    const ctx=state.ctx;hideContextActions();await showBibleVerseRefs(ctx.el);return;
  }
  if(act==='info'&&state.kind==='block'){
    const el=state.el;hideContextActions();await showBlockInfo(el);return;
  }
  if(act==='erase'&&state.kind==='highlight'){
    const id=state.highlightId;hideContextActions();await clearHighlight(id);return;
  }
  if(act==='copy'){
    let text='';
    if(state.kind==='verse')text=verseTextForCopy(state.ctx.el);
    else if(state.kind==='selection'){text=plainTextFromRange(state.range)}
    else if(state.kind==='block'){text=blockText(state.el)}
    else if(state.kind==='highlight'){const h=await getOne('highlights',state.highlightId);text=String(h&&h.quote||'')}
    text=text.replace(/[\u200b-\u200d]/g,'').trim();
    hideContextActions();
    if(!text)return;
    try{if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);else await copyText(text);say(t('已复制'),text.slice(0,160))}catch(err){say(t('复制失败'),err.message||String(err))}
    return;
  }
  if(act==='note'){
    if(state.kind==='highlight'){
      const id=state.highlightId;hideContextActions();await openHighlightNote(id);return;
    }
    if(state.kind==='verse'){
      const ctx=state.ctx;hideContextActions();verseActionState=ctx;await doVerseAction('note');return;
    }
    if(state.kind==='block'){
      await doBlockAction('note');return;
    }
    if(state.kind==='selection'){
      const range=state.range;hideContextActions();
      const h=await createHighlightFromRange(range,'#ffe58a');if(h)await openHighlightNote(h.id);
    }
  }
});
document.addEventListener('click',e=>{const panel=$('readerSearchPanel');if(!panel||!panel.classList.contains('show'))return;if(panel.contains(e.target))return;if(e.target.closest&&e.target.closest('#readerSearchBtn,#librarySearchBtn,.bible-search-btn'))return;closeReaderSearch()},true);
document.addEventListener('copy',e=>{
  try{
    const sel=window.getSelection();
    if(!sel||!sel.rangeCount)return;
    const range=sel.getRangeAt(0),article=$('article');
    if(!article||!article.contains(range.commonAncestorContainer))return;
    const text=plainTextFromRange(range);
    if(!text||!e.clipboardData)return;
    e.clipboardData.setData('text/plain',text);e.preventDefault();
  }catch(err){}
});
document.addEventListener('selectionchange',scheduleHighlightToolbar);
document.addEventListener('mouseup',scheduleHighlightToolbar);
document.addEventListener('touchend',scheduleHighlightToolbar,{passive:true});
$('readerBody').addEventListener('scroll',hideHighlightToolbar,{passive:true});
$('readerBody').addEventListener('scroll',hideVerseActions,{passive:true});
document.addEventListener('click',e=>{
  if(!linkPanelOpen())return;
  // The desktop side panel is persistent; it is closed with its own button or Esc.
  if(linkPanelDocked())return;
  if($('linkPopover').contains(e.target))return;
  if(e.target.closest&&e.target.closest('a[data-jwlink]'))return;
  closeLinkPopover();
  dismissRegionSelection();
  // Closing the panel on inert article text must not also select a new verse
  // or paragraph behind it.
  if($('article')&&$('article').contains(e.target)&&!(e.target.closest&&e.target.closest('a,.hl,.hl-note-mark,.m[data-mid],.fn,.v .cl')))e.stopPropagation();
},true);
document.addEventListener('click',e=>{
  const bar=$('contextActions');
  if(!bar||!bar.classList.contains('show'))return;
  if(bar.contains(e.target))return;
  // Taps inside the article are resolved by the article handler so one tap can
  // both abandon the region and refuse to pick a new one.
  if($('article')&&$('article').contains(e.target))return;
  dismissRegionSelection();
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeLinkPopover();dismissRegionSelection()}});
let linkPanelDockedAt=linkPanelDocked();
window.addEventListener('resize',()=>{const docked=linkPanelDocked();if(docked!==linkPanelDockedAt){closeLinkPopover();linkPanelDockedAt=docked}else if(!docked&&$('linkPopover').style.display==='block')positionLinkPopover(null)});

function cleanTocTitle(v){return String(v||'').replace(/[\u200b-\u200d\ufeff]/g,'').trim()}
function bibleTocBookNumber(title){
  const value=cleanTocTitle(title);if(!value||!currentBook)return 0;
  const books=(currentBook.bibleStructure&&currentBook.bibleStructure.books)||[];
  const hit=books.find(b=>cleanTocTitle(b.name)===value);
  if(hit)return Number(hit.num)||0;
  const names=(currentBook.bibleData&&currentBook.bibleData.bookNames)||{};
  for(const [num,name] of Object.entries(names))if(cleanTocTitle(name)===value)return Number(num)||0;
  return 0;
}
async function openBibleBookFromToc(bookNum){
  if(!bookNum||!currentBook)return;
  const id=currentBook.id,origin=readerSessionTab||readerOriginSection||primarySection||'bible';
  $('drawer').style.display='none';
  if(origin==='bible'){
    bibleSelectedBook=bookNum;bibleSection='正文';currentBibleId=id;
    await setPrimaryNav('bible',{skipRestore:true});
    try{delete sectionViews.bible}catch(e){}
    return;
  }
  // A Bible opened from the library (for example an English edition) should
  // not jump into the Bible section when a book is chosen in its TOC.
  if(id)currentBibleId=id;
  await openBibleChapterReader(id,bookNum,1,0,origin);
}