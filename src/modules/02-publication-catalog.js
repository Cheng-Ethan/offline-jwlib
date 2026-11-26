function flattenMeta(v){if(v==null)return '';if(Array.isArray(v))return v.map(flattenMeta).join(' ');if(typeof v==='object')return Object.values(v).map(flattenMeta).join(' ');return String(v)}
function categoryPathFromLeaf(leaf){
  const id=String(leaf||'uncategorized');
  const parts=id.split('.');
  return parts.length>1?[parts[0],id]:[id];
}
function configRuleMatches(rule,fields){
  const match=rule&&rule.match;if(!match||typeof match!=='object')return false;
  for(const [key,patterns] of Object.entries(match)){
    if(key==='hasBible'){if(fields.hasBible)return true;continue}
    const value=String(fields[key]||'');
    if(!value)continue;
    const list=Array.isArray(patterns)?patterns:[patterns];
    for(const p of list){
      let ok=false;
      try{ok=new RegExp(String(p),'i').test(value)}catch(e){ok=value.toLowerCase().includes(String(p).toLowerCase())}
      if(ok)return true;
    }
  }
  return false;
}
function configuredCategory(b){
  const cfg=typeof window!=='undefined'&&window.__CATEGORY_CONFIG__;
  if(!cfg||!Array.isArray(cfg.rules)||!cfg.rules.length)return null;
  const mp=b.manifestRaw?.publication||{};
  const fields={
    uniqueEnglishSymbol:b.uniqueEnglishSymbol||mp.uniqueEnglishSymbol||'',
    englishSymbol:b.englishSymbol||mp.englishSymbol||'',
    symbol:b.symbol||mp.symbol||'',
    publicationType:b.publicationType||mp.publicationType||'',
    publicationCategorySymbol:b.publicationCategorySymbol||mp.publicationCategorySymbol||'',
    categoryCodes:[...(Array.isArray(b.categoryCodes)?b.categoryCodes:[]),...(Array.isArray(mp.categories)?mp.categories:[])].join(' '),
    categories:flattenMeta(b.categories||mp.categories||[]),
    attributes:flattenMeta(b.attributes||mp.attributes||[]),
    title:[b.displayTitle,b.title,mp.displayTitle,mp.title].filter(Boolean).join(' '),
    hasBible:!!(b.bibleData||b.hasBible)
  };
  for(const rule of [...cfg.rules].sort((a,b)=>Number(a.priority||0)-Number(b.priority||0))){
    if(configRuleMatches(rule,fields))return categoryPathFromLeaf(rule.category);
  }
  return ['uncategorized'];
}
function classifyPublication(b){
  const configured=configuredCategory(b);if(configured)return configured;
  const code=String(b.publicationCategorySymbol||(Array.isArray(b.categoryCodes)?b.categoryCodes[0]:'')||'').toLowerCase();
  if(code==='es')return ['daily'];
  if(code==='bi')return ['bible'];
  if(code==='g')return ['magazines','magazines.awake'];
  if(code==='w')return ['magazines','magazines.watchtower'];
  if(code==='mwb')return ['meetings'];
  if(/^sj/.test(code))return ['songs'];
  if(/^(dx|it|rs|rsg)$/.test(code))return ['reference'];
  if(code==='bk')return ['books'];
  if(code==='br')return ['brochures','brochures.booklets'];
  if(code==='tr')return ['brochures','brochures.tracts'];
  const mp=b.manifestRaw?.publication||{};
  const type=String(b.publicationType||mp.publicationType||'').toLowerCase();
  const sym=String(b.uniqueEnglishSymbol||b.englishSymbol||b.symbol||'').toLowerCase();
  const title=String(b.displayTitle||b.title||'').toLowerCase();
  const extras=flattenMeta([b.categories,b.attributes,mp.type,mp.shortTitle,mp.referenceTitle,mp.undatedReferenceTitle]).toLowerCase();
  const all=[type,sym,title,extras].join(' ');
  if(/daily.?text|examining the scriptures|每日经文|天天查考圣经/.test(all)||/^es\d/.test(sym))return ['daily'];
  if(b.bibleData||b.hasBible||/^(nwt|nwtsty|bi12|bi10|rbi8|by|bible)/.test(sym)||/^bible/.test(type))return ['bible'];
  if(/watchtower|awake|magazine|杂志|守望台|警醒/.test(all)||/^(w|g)\d/.test(sym)){
    let sub='magazines.other';
    if(/awake|警醒/.test(all)||/^g/.test(sym))sub='magazines.awake';
    else if(/watchtower|守望台/.test(all)||/^w/.test(sym)){
      if(/study|研读/.test(all)||(/^w/.test(sym)&&!/^wp/.test(sym)))sub='magazines.watchtower.study';
      else if(/public|公众/.test(all)||/^wp/.test(sym))sub='magazines.watchtower.public';
      else sub='magazines.watchtower';
    }
    return ['magazines',sub];
  }
  if(/tract|invitation|单张|传单|邀请函/.test(all)||/tract|inv/.test(type))return ['brochures','brochures.tracts'];
  if(/brochure|booklet|册子|小册子/.test(all)||/brochure/.test(type))return ['brochures','brochures.booklets'];
  if(/program|meeting|workbook|assembly|convention|聚会|工作手册|大会|节目/.test(all)||/^(mwb|th|ca|co|mem)/.test(sym))return ['meetings'];
  if(/research guide|index|encyclopedia|insight|索引|研究指南|洞悉/.test(all)||/^(dx|it|rs|rsg)/.test(sym))return ['reference'];
  if(/song|sing out|诗歌|唱诗/.test(all))return ['songs'];
  if(/book|书籍/.test(type)||/books?/.test(extras))return ['books'];
  return ['uncategorized'];
}
const LEGACY_CATEGORY_MAP={
  '圣经':'bible','书籍':'books','杂志':'magazines','册子和单张':'brochures','聚会资料':'meetings','索引和参考资料':'reference','每日经文':'daily','诗歌':'songs','其他':'other','未分类':'uncategorized',
  '守望台':'magazines.watchtower','守望台 · 研读版':'magazines.watchtower.study','守望台 · 公众版':'magazines.watchtower.public','警醒！':'magazines.awake','其他杂志':'magazines.other',
  '单张和邀请函':'brochures.tracts','册子':'brochures.booklets'
};
function categoryPath(b){
  let p;
  if(b&&b.categoryId)p=[String(b.categoryId)];
  else if(Array.isArray(b&&b.categoryPath)&&b.categoryPath.length)p=b.categoryPath.slice();
  else p=classifyPublication(b);
  return p.map(x=>LEGACY_CATEGORY_MAP[x]||String(x));
}
function estimateBookSize(b){if(Number(b.estimatedSize))return Number(b.estimatedSize);let n=0;for(const d of b.docs||[])n+=(d.html||'').length*2;for(const a of b.assets||[])n+=Number(a.blob?.size||0);for(const v of b.bibleData?.verseRows||[])n+=Number(v.content?.byteLength||v.content?.length||0);return n}
function bookMatches(b,q){return !q||[b.title,b.displayTitle,b.shortTitle,b.symbol,b.publicationType,...(b.categories||[]),...(b.attributes||[]),...categoryPath(b),...categoryPath(b).map(catLabel)].join(' ').toLowerCase().includes(q)}
function categoryCounts(books,prefix){const m=new Map();for(const b of books){const p=categoryPath(b);if(p.length<=prefix.length||!prefix.every((x,i)=>p[i]===x))continue;const key=p[prefix.length];m.set(key,(m.get(key)||0)+1)}return m}
function clearLibraryLists(){ $('categories').innerHTML='';$('books').innerHTML=''; }
function addCategoryCard(name,count,prefix){const meta=CATEGORY_META[name]||{icon:'folder',desc:'按此分类浏览'};const el=document.createElement('button');el.className='category-card';el.innerHTML=`<span class="category-icon">${svgIcon(meta.icon,22)}</span><span><strong>${safeText(catLabel(name))}</strong><small>${count} ${t('本')} · ${safeText(t(meta.desc))}</small></span>`;el.onclick=()=>{categoryTrail=[...prefix,name];renderBooks()};$('categories').appendChild(el)}
const BOOK_CATEGORIES=['bible','books','magazines','brochures','meetings','reference','daily','songs','other','uncategorized'];
async function ensureCategoryIds(){
  let flag=null;try{flag=await getOne('system','categoryIdsV1')}catch(e){}
  if(flag&&flag.done)return;
  let changed=0;
  try{
    const metas=await allBooks();
    for(const m of metas){
      if(m.categoryId)continue;
      if(!Array.isArray(m.categoryPath)||!m.categoryPath.length)continue;
      const meta=await getBookMeta(m.id);if(!meta)continue;
      const path=meta.categoryPath.map(x=>LEGACY_CATEGORY_MAP[x]||String(x));
      meta.categoryId=path[0];meta.categoryPath=path;meta.categorySource=meta.categorySource||'legacy';
      await saveBookMeta(meta);changed++;
    }
  }catch(e){}
  try{await reqP(tx('system','readwrite').put({id:'categoryIdsV1',done:true,at:Date.now(),changed}))}catch(e){}
}
async function loadCustomCategories(){
  try{const rows=await reqP(tx('categories').getAll());CUSTOM_CATEGORIES=new Map(rows.map(r=>[String(r.id),r]))}catch(e){CUSTOM_CATEGORIES=new Map()}
  return CUSTOM_CATEGORIES;
}
async function createCustomCategory(name){
  const clean=String(name||'').trim();if(!clean)return '';
  const id='custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
  const cat={id,name:clean,builtIn:false,createdAt:Date.now()};
  await saveOne('categories',cat);CUSTOM_CATEGORIES.set(id,cat);return id;
}
function categoryMenuItems(){
  const out=BOOK_CATEGORIES.map(id=>({id,label:catLabel(id)}));
  for(const c of CUSTOM_CATEGORIES.values())if(!out.some(x=>x.id===c.id))out.push({id:String(c.id),label:c.name||String(c.id)});
  return out;
}
function closeCategoryManager(){const m=document.getElementById('categoryManagerMenu');if(m)m.remove()}
async function showCategoryManager(anchor){
  closeCategoryManager();await loadCustomCategories();
  const all=await allBooks();
  const menu=document.createElement('div');menu.id='categoryManagerMenu';menu.className='book-action-menu category-manager';
  const title=document.createElement('div');title.className='book-action-title';title.textContent=t('分类管理');menu.appendChild(title);
  const customs=[...CUSTOM_CATEGORIES.values()];
  if(!customs.length){const e=document.createElement('div');e.className='book-action';e.textContent=t('还没有自定义分类。');menu.appendChild(e)}
  for(const c of customs){
    const count=all.filter(b=>String(b.categoryId||categoryPath(b)[0])===String(c.id)).length;
    const row=document.createElement('div');row.className='category-manage-row';
    const name=document.createElement('button');name.className='book-action category-manage-name';name.textContent=`${c.name} (${count})`;
    name.onclick=async e=>{e.stopPropagation();const v=prompt(t('重命名分类'),c.name);if(v===null)return;const clean=String(v).trim();if(!clean)return;const updated={...c,name:clean};await saveOne('categories',updated);CUSTOM_CATEGORIES.set(String(c.id),updated);closeCategoryManager();renderSection()};
    const del=document.createElement('button');del.className='category-manage-del';del.innerHTML=svgIcon('close',16);del.title=t('删除分类');del.setAttribute('aria-label',t('删除分类'));
    del.onclick=async e=>{e.stopPropagation();if(!(await askConfirm(t('删除分类'),t('删除分类')+'：'+c.name+'？')))return;
      for(const b of all){if(String(b.categoryId||categoryPath(b)[0])!==String(c.id))continue;const meta=await getBookMeta(b.id);if(!meta)continue;meta.categoryId='uncategorized';meta.categoryPath=['uncategorized'];meta.categorySource='manual';await saveBookMeta(meta)}
      try{await reqP(tx('categories','readwrite').delete(c.id))}catch(err){}CUSTOM_CATEGORIES.delete(String(c.id));closeCategoryManager();renderSection();
    };
    row.append(name,del);menu.appendChild(row);
  }
  const re=document.createElement('button');re.className='book-action';re.innerHTML=svgIcon('search',18)+'<span></span>';re.lastChild.textContent=t('重新自动分类未手动归类的出版物');
  re.onclick=async e=>{e.stopPropagation();if(!(await askConfirm(t('重新自动分类未手动归类的出版物'),t('重新自动分类未手动归类的出版物')+'？')))return;
    const metas=await allBooks();let n=0;
    for(const b of metas){if(b.categorySource==='manual')continue;const meta=await getBookMeta(b.id);if(!meta)continue;const path=classifyPublication(meta);meta.categoryId=path[0];meta.categoryPath=path;meta.categorySource='auto';await saveBookMeta(meta);n++}
    closeCategoryManager();renderSection();say(t('分类管理'),t('已重新分类')+' '+n+' '+t('项'));
  };menu.appendChild(re);
  const rect=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(rect.right-240,window.innerWidth-260))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+6,window.innerHeight-320))+'px';
  document.body.appendChild(menu);
}
let bookMenuOpenedAt=0,langMenuOpenedAt=0;
function closeBookActions(){const m=document.getElementById('bookActionMenu');if(m)m.remove()}
function positionBookMenu(menu,anchor){
  const rect=anchor.getBoundingClientRect();
  const w=Math.min(220,menu.offsetWidth||180);
  let left=Math.max(8,Math.min(rect.right-w,window.innerWidth-w-8));
  let top=rect.bottom+6;
  if(top+240>window.innerHeight)top=Math.max(8,rect.top-246);
  menu.style.left=left+'px';menu.style.top=top+'px';
}
function openBookActions(book,anchor){
  closeBookActions();
  const menu=document.createElement('div');menu.id='bookActionMenu';menu.className='book-action-menu';
  const add=(label,fn,cls,icon)=>{const b=document.createElement('button');b.className='book-action '+(cls||'');b.innerHTML=svgIcon(icon||'right',18)+'<span></span>';b.lastChild.textContent=label;b.onclick=e=>{e.stopPropagation();closeBookActions();fn()};menu.appendChild(b)};
  add(book.favorite?t('取消收藏'):t('收藏该出版物'),async()=>{const meta=await getBookMeta(book.id);if(!meta)return;meta.favorite=!meta.favorite;await saveBookMeta(meta);renderSection()},'',book.favorite?'starOn':'star');
  add(t('移动分类'),()=>openCategoryPicker(book,anchor),'','folder');
  add(t('分享 / 导出…'),()=>openShareMenu(book,anchor),'','download');
  add(t('删除'),async()=>{if(!(await askConfirm(t('删除'),`确定删除《${book.displayTitle||book.title}》及其关联笔记、书签和阅读记录吗？`)))return;await deletePublication(book);renderSection()},'delete','trash');
  document.body.appendChild(menu);positionBookMenu(menu,anchor);bookMenuOpenedAt=Date.now();
}
function openShareMenu(book,anchor){
  closeBookActions();
  const menu=document.createElement('div');menu.id='bookActionMenu';menu.className='book-action-menu';
  const add=(label,fn,icon)=>{const b=document.createElement('button');b.className='book-action';b.innerHTML=svgIcon(icon||'right',18)+'<span></span>';b.lastChild.textContent=label;b.onclick=e=>{e.stopPropagation();closeBookActions();fn()};menu.appendChild(b)};
  if(book.hasSource)add(t('导出原始 JWPUB'),()=>exportBookJwpub(book),'download');
  else add(t('重新导入以启用分享…'),()=>promptReimportForShare(book),'upload');
  add(t('返回'),()=>openBookActions(book,anchor),'left');
  document.body.appendChild(menu);positionBookMenu(menu,anchor);bookMenuOpenedAt=Date.now();
}
function promptReimportForShare(book){
  // Keep this inside the original click gesture so iOS/Sitecase can open the
  // file picker; the import dialog explains the one-time re-import.
  try{$('fileInput').click()}catch(e){}
}
async function openCategoryPicker(book,anchor){
  closeBookActions();await loadCustomCategories();
  const menu=document.createElement('div');menu.id='bookActionMenu';menu.className='book-action-menu category-picker';
  const title=document.createElement('div');title.className='book-action-title';title.textContent=t('移动到分类');menu.appendChild(title);
  const cur=categoryPath(book)[0];
  const move=async id=>{const meta=await getBookMeta(book.id);if(!meta)return;meta.categoryId=id;meta.categoryPath=[id];meta.categorySource='manual';await saveBookMeta(meta);closeBookActions();renderSection()};
  categoryMenuItems().forEach(item=>{
    const b=document.createElement('button');b.className='book-action'+(cur===item.id?' active':'');b.innerHTML=svgIcon(cur===item.id?'check':'folder',18)+'<span></span>';b.lastChild.textContent=item.label;
    b.onclick=async e=>{e.stopPropagation();await move(item.id)};menu.appendChild(b);
  });
  const mk=document.createElement('button');mk.className='book-action';mk.innerHTML=svgIcon('plus',18)+'<span></span>';mk.lastChild.textContent=t('新建分类…');
  mk.onclick=async e=>{e.stopPropagation();const name=prompt(t('新分类名称'));const id=await createCustomCategory(name);if(id)await move(id);else closeBookActions()};
  menu.appendChild(mk);
  document.body.appendChild(menu);positionBookMenu(menu,anchor);bookMenuOpenedAt=Date.now();
}
function makeBookCard(b){
  const el=document.createElement('div');el.className='book book-compact';el.tabIndex=0;
  const main=document.createElement('div');main.className='book-main';
  const cover=document.createElement('div');cover.className='cover';cover.innerHTML=svgIcon('book',20);
  const block=document.createElement('div');block.className='book-title-block';
  const h=document.createElement('h3');h.textContent=b.displayTitle||b.title||t('未命名出版物');
  const file=document.createElement('small');file.className='source-file';file.textContent=langLabel(b.lang)+' · '+sourceFileName(b.originalFilename||b.manifestName||t('原始文件未知'));
  block.append(h,file);main.append(cover,block);
  const more=document.createElement('button');more.className='book-more';more.innerHTML=svgIcon('more',18);more.title=t('更多操作');more.setAttribute('aria-label',t('更多操作'));
  more.onclick=e=>{e.stopPropagation();openBookActions(b,more)};
  const open=()=>openBook(b.id);
  el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();open()}};
  el.append(main,more);
  return el;
}
function addBookCard(b){$('books').appendChild(makeBookCard(b))}
function appendBookGrid(container,list){
  if(!list.length)return;
  const grid=document.createElement('div');grid.className='grid';
  list.forEach(b=>grid.appendChild(makeBookCard(b)));
  container.appendChild(grid);
}

const BOOK_ABBR=['创','出','利','民','申','书','士','得','撒上','撒下','王上','王下','代上','代下','拉','尼','斯','伯','诗','箴','传','歌','赛','耶','哀','结','但','何','珥','摩','俄','拿','弥','鸿','哈','番','该','亚','玛','太','可','路','约','徒','罗','林前','林后','加','弗','腓','西','帖前','帖后','提前','提后','多','门','来','雅','彼前','彼后','约一','约二','约三','犹','启'];
const BOOK_ABBR_EN=['Gen','Ex','Lev','Num','Deut','Josh','Judg','Ruth','1Sam','2Sam','1Kgs','2Kgs','1Chr','2Chr','Ezra','Neh','Esth','Job','Ps','Prov','Eccl','Song','Isa','Jer','Lam','Ezek','Dan','Hos','Joel','Amos','Obad','Jonah','Mic','Nah','Hab','Zeph','Hag','Zech','Mal','Matt','Mark','Luke','John','Acts','Rom','1Cor','2Cor','Gal','Eph','Phil','Col','1Thess','2Thess','1Tim','2Tim','Titus','Phlm','Heb','Jas','1Pet','2Pet','1John','2John','3John','Jude','Rev'];
const BOOK_ABBR_JA=['創','出','レビ','民','申','ヨシュ','士','ルツ','サム一','サム二','王一','王二','代一','代二','エズ','ネヘ','エス','ヨブ','詩','箴','伝','歌','イザ','エレ','哀','エゼ','ダニ','ホセ','ヨエ','アモ','オバ','ヨナ','ミカ','ナホ','ハバ','ゼパ','ハガ','ゼカ','マラ','マタ','マル','ルカ','ヨハ','使','ロマ','コリ一','コリ二','ガラ','エフェ','フィリ','コロ','テサ一','テサ二','テモ一','テモ二','テト','フィレ','ヘブ','ヤコ','ペテ一','ペテ二','ヨハ一','ヨハ二','ヨハ三','ユダ','啓'];
function bookAbbr(n,bookLang){const l=Number(bookLang);const code=l===0?'en':l===7?'ja':l===279?'zh':(uiLang==='en'||uiLang==='ko'?'en':uiLang==='ja'?'ja':'zh');const arr=code==='en'?BOOK_ABBR_EN:code==='ja'?BOOK_ABBR_JA:BOOK_ABBR;return arr[n-1]||String(n)}
const BIBLE_GROUPS=[{key:'torah',label:'摩西五经',from:1,to:5},{key:'history',label:'历史书',from:6,to:17},{key:'poetry',label:'诗歌智慧书',from:18,to:22},{key:'major',label:'大先知书',from:23,to:27},{key:'minor',label:'小先知书',from:28,to:39},{key:'gospels',label:'福音书',from:40,to:43},{key:'acts',label:'使徒行传',from:44,to:44},{key:'paul',label:'保罗书信',from:45,to:58},{key:'general',label:'一般书信',from:59,to:65},{key:'revelation',label:'启示录',from:66,to:66}];
function bookGroupKey(n){const g=BIBLE_GROUPS.find(x=>n>=x.from&&n<=x.to);return g?g.key:'other'}
const BIBLE_TABS=['简介','正文','检索','附录A','附录B','附录C'];
const BIBLE_TAB_ALIASES={
  introduction:'简介',intro:'简介',紹介:'简介',소개:'简介',
  text:'正文',本文:'正文',본문:'正文',
  index:'检索',索引:'检索',색인:'检索',
  'appendix a':'附录A','appendix b':'附录B','appendix c':'附录C',
  '付録a':'附录A','付録b':'附录B','付録c':'附录C',
  '부록 a':'附录A','부록 b':'附录B','부록 c':'附录C'
};
function normBibleTitle(v){return String(v||'').replace(/[\u200b\u200c\u200d]/g,'').trim()}
function bibleTabKey(v){const s=normBibleTitle(v);if(BIBLE_TABS.includes(s))return s;const k=BIBLE_TAB_ALIASES[s.toLowerCase()];return k||s}
function stripHtmlText(html){try{const d=document.createElement('div');d.innerHTML=String(html||'');return (d.textContent||'').replace(/\s+/g,' ').trim()}catch(e){return String(html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}}
function extractDailyVerse(html){
  try{
    const doc=new DOMParser().parseFromString(String(html||''),'text/html');
    doc.querySelectorAll('rt,rp,script,style').forEach(n=>n.remove());
    const clean=v=>String(v||'').replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim();
    const date=clean((doc.querySelector('header h2,header h1')||{}).textContent);
    const theme=doc.querySelector('.themeScrp');
    let verse=theme?clean(theme.textContent):'';
    if(!verse){const p=doc.querySelector('.bodyTxt p,p');verse=clean(p&&p.textContent)}
    return {date,verse};
  }catch(e){return {date:'',verse:''}}
}

function langLabel(n){return contentLangName(n)}
function orderedBibles(books){
  const bibles=books.filter(b=>b.hasBible);
  let ids=[];try{ids=JSON.parse(localStorage.getItem('offlineLibraryBibleOrder')||'[]')}catch(e){}
  const map=new Map(bibles.map(b=>[b.id,b]));const out=[];
  for(const id of ids){const b=map.get(id);if(b){out.push(b);map.delete(id)}}
  const rest=[...map.values()].sort((a,b)=>Number(b.year||0)-Number(a.year||0)||String(a.displayTitle||a.title).localeCompare(String(b.displayTitle||b.title),'zh-CN'));
  return out.concat(rest);
}
function saveBibleOrderIds(ids){try{localStorage.setItem('offlineLibraryBibleOrder',JSON.stringify(ids))}catch(e){}}

function dateKey(d){return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate()}
function dateOffsetKey(offset,year){const n=Number(offset);if(!Number.isFinite(n))return 0;if(n>19000101)return n;const d=new Date(Date.UTC(Number(year)||new Date().getFullYear(),0,1));d.setUTCDate(d.getUTCDate()+n);return d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate()}
let dailyHomeDirty=false;
function preferredDailyBookId(){try{return String(localStorage.getItem('offlineLibraryDailyBookId')||'')}catch(e){return ''}}
function rememberDailyBook(id){
  const key=String(id||'');if(!key)return;
  const previous=preferredDailyBookId();
  try{localStorage.setItem('offlineLibraryDailyBookId',key)}catch(e){}
  if(previous!==key)dailyHomeDirty=true;
}
async function findTodayDaily(books){
  const today=new Date(),key=dateKey(today);
  const candidates=books.filter(b=>isDailyTextPublication(b)&&Array.isArray(b.dailyDocs)&&b.dailyDocs.length);
  const preferred=preferredDailyBookId();
  if(preferred){const at=candidates.findIndex(b=>String(b.id)===preferred);if(at>0)candidates.unshift(candidates.splice(at,1)[0])}
  for(const b of candidates){
    const list=b.dailyDocs;
    let doc=list.find(x=>Number(x.dateKey)===key)||list.find(x=>{const a=Number(x.dateOffset),z=Number(x.lastDateOffset??x.dateOffset);return a>19000101&&key>=a&&key<=z});
    if(!doc){
      const y=Number(b.year)||today.getFullYear();
      const off=Math.floor((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(y,0,1))/86400000);
      doc=list.find(x=>{const a=Number(x.dateOffset),z=Number(x.lastDateOffset??x.dateOffset);return a<=10000000&&off>=a&&off<=z});
    }
    if(doc)return {book:b,doc};
  }
  return null;
}
const navScroll={home:0,bible:0,library:0,meetings:0,study:0,more:0,history:0};
let navTapTab=null,navTapAt=0;
function activateTab(tab,reset,opts={}){
  const epoch=++tabEpoch;
  const prev=primarySection;
  const hadOpenEditor=!!(noteEditorState&&!noteEditorState.minimized);
  if(hadOpenEditor)minimizeNoteEditor(prev===tab);
  const readerOpen=$('reader').style.display==='block';
  // A hidden reader has no active tab. Leaving a stale session here is what
  // allowed a later back arrow to look up another tab's reading history.
  if(!readerOpen){readerSessionTab=null;readerOriginSection=null;}
  const readerTab=readerSessionTab||readerNavSection;
  if(readerOpen&&!reset&&tab===readerTab&&!opts.skipRestore){document.querySelectorAll('#bottomNav button').forEach(x=>x.classList.toggle('active',x.dataset.primary===(tab==='more'||tab==='history'?'study':tab)));return Promise.resolve()}
  if(prev===tab&&!reset&&!readerOpen&&!opts.forceRender){
    if(tab==='home'&&dailyHomeDirty)return renderSection();
    if(!opts.skipRestore&&!hadOpenEditor&&sectionViews[tab])return restoreSectionView(tab).then(ok=>{if(epoch!==tabEpoch)return;return ok?undefined:renderSection().then(()=>{if(epoch===tabEpoch)window.scrollTo(0,navScroll[tab]||0)})});
    return hadOpenEditor?renderSection():Promise.resolve();
  }
  if(prev!==tab&&!readerOpen)navScroll[prev]=window.scrollY||document.documentElement.scrollTop||0;
  if(reset)resetSectionState(tab);
  const willRestore=!reset&&!opts.skipRestore&&!!sectionViews[tab];
  if(readerOpen){
    const sourceTab=readerSessionTab||readerOriginSection||readerNavSection||primarySection;
    storeReaderView(sourceTab,true);cancelReaderPositionRestore();
    hideVerseActions();closeLinkPopover();clearUrls();bibleMode=false;bibleReturn=null;setBibleToolbar(false);readerReturnSection=null;readerOriginSection=null;readerSessionTab=null;readerReturnTarget=null;readerSearchReturn=null;
    // Hide the old tab's article immediately. Keeping it visible while the
    // target tab's article loaded made the old article look like part of the
    // new tab and confused both the back history and the reading position.
    $('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid';
  }
  primarySection=tab;
  scheduleReaderCacheSave();
  const isHome=tab==='home';
  const topBar=document.querySelector('.top');if(topBar)topBar.style.display=isHome?'flex':'none';
  document.body.classList.toggle('section-mode',!isHome);
  const activeTab=tab==='more'||tab==='history'?'study':tab;
  document.querySelectorAll('#bottomNav button').forEach(x=>x.classList.toggle('active',x.dataset.primary===activeTab));
  document.querySelectorAll('[data-reader-primary]').forEach(x=>x.classList.toggle('active',x.dataset.readerPrimary===activeTab));
  if(willRestore){
    return restoreSectionView(tab).then(ok=>{
      if(epoch!==tabEpoch)return;
      if(ok)return;
      readerSessionTab=null;readerOriginSection=null;readerReturnTarget=null;readerReturnSection=null;
      $('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid';
      return renderSection().then(()=>{if(epoch===tabEpoch)window.scrollTo(0,navScroll[tab]||0)});
    });
  }
  return renderSection().then(()=>{if(epoch===tabEpoch)window.scrollTo(0,reset?0:(navScroll[tab]||0))});
}
function setPrimaryNav(tab,opts){return activateTab(tab,false,opts||{})}
function onNavTap(tab){
  const now=Date.now();
  if(navTapTab===tab&&now-navTapAt<320){navTapTab=null;navTapAt=0;activateTab(tab,true);return}
  navTapTab=tab;navTapAt=now;
  // Enter immediately. Waiting to distinguish a double tap made a single tap
  // feel unresponsive and often caused a second tap to reset the section.
  activateTab(tab,false);
}
function resetSectionState(tab){
  try{delete sectionViews[tab]}catch(e){}
  try{clearReaderHistory(tab)}catch(e){}
  scheduleReaderCacheSave();
  if(tab==='bible'){bibleSelectedBook=null;bibleSection='正文';}
  else if(tab==='library'){libraryTab='publications';categoryTrail=[];}
  else if(tab==='meetings'){meetingBookId=null;meetingWeekDocId=null;meetingsExpanded=true;}
}
function closeLangMenu(){const m=document.getElementById('langMenu');if(m)m.remove()}
function setUiLang(code){
  if(!UI_LANGS[code])return;
  uiLang=code;
  try{localStorage.setItem('offlineLibraryUiLang',code)}catch(e){}
  closeLangMenu();closeContentLangMenu();closeCategoryManager();
  applyI18n();
  try{if(typeof applySidebarState==='function')applySidebarState();if(typeof applyTocState==='function')applyTocState()}catch(e){}
  if(typeof renderSection==='function'){try{renderSection()}catch(e){console.error('switch language render failed',e)}}
}
function showLangMenu(anchor){
  closeLangMenu();
  const menu=document.createElement('div');menu.id='langMenu';menu.className='book-action-menu';
  Object.entries(UI_LANGS).forEach(([code,info])=>{
    const b=document.createElement('button');b.className='book-action'+(code===uiLang?' active':'');b.textContent=info.name;
    b.onclick=e=>{e.stopPropagation();setUiLang(code)};
    menu.appendChild(b);
  });
  const add=document.createElement('button');add.className='book-action';add.innerHTML=svgIcon('plus',18);add.title=t('导入语言包');add.setAttribute('aria-label',t('导入语言包'));
  add.onclick=e=>{e.stopPropagation();closeLangMenu();const f=$('languagePackInput');if(f)f.click()};menu.appendChild(add);
  const rect=anchor.getBoundingClientRect();menu.style.left=Math.max(8,rect.right-160)+'px';menu.style.top=(rect.bottom+6)+'px';
  document.body.appendChild(menu);langMenuOpenedAt=Date.now();
}
async function contentLanguageList(){
  const all=await allBooks(),map=new Map();
  for(const b of all){const k=String(Number(b.lang)||0);if(!map.has(k))map.set(k,{lang:Number(b.lang)||0,count:0});map.get(k).count++}
  return [...map.values()].sort((a,b)=>a.lang-b.lang);
}
function closeContentLangMenu(){const m=document.getElementById('contentLangMenu');if(m)m.remove()}
function setContentLangFilter(value){
  contentLangFilter=value==='all'?'all':String(Number(value));
  try{localStorage.setItem('offlineLibraryContentLang',contentLangFilter)}catch(e){}
  closeContentLangMenu();
  renderSection();
}
async function showContentLangMenu(anchor){
  closeContentLangMenu();
  const langs=await contentLanguageList();
  const menu=document.createElement('div');menu.id='contentLangMenu';menu.className='book-action-menu';
  const all=document.createElement('button');all.className='book-action'+(contentLangFilter==='all'?' active':'');all.textContent=t('全部语言');all.onclick=e=>{e.stopPropagation();setContentLangFilter('all')};menu.appendChild(all);
  langs.forEach(item=>{
    const b=document.createElement('button');b.className='book-action'+(String(item.lang)===String(contentLangFilter)?' active':'');b.textContent=`${contentLangName(item.lang)} (${item.count})`;
    b.onclick=e=>{e.stopPropagation();setContentLangFilter(item.lang)};menu.appendChild(b);
  });
  const rect=anchor.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-220))+'px';menu.style.top=(rect.bottom+6)+'px';
  document.body.appendChild(menu);
}
async function renderContentLangBar(){
  const bar=$('contentLangBar');if(!bar)return;
  const langs=await contentLanguageList();bar.innerHTML='';
  if(!langs.length){bar.style.display='none';return}
  bar.style.display='flex';
  const add=(label,value)=>{
    const b=document.createElement('button');b.type='button';b.className='content-lang-chip'+(String(contentLangFilter)===String(value)?' active':'');
    b.textContent=label;b.onclick=()=>setContentLangFilter(value);bar.appendChild(b);
  };
  add(t('全部语言'),'all');
  langs.forEach(item=>add(`${contentLangName(item.lang)} ${item.count}`,item.lang));
}
function setLibraryTab(tab){primarySection='library';libraryTab=tab;categoryTrail=[];renderSection().then(()=>window.scrollTo(0,0))}
function sectionPanel(title,desc,opts={}){
  const box=document.createElement('section');box.className='section-panel';
  const head=document.createElement('div');head.className='section-panel-head';
  const h=document.createElement('h2');h.textContent=t(title);head.appendChild(h);
  const p=document.createElement('p');p.className='sub section-help-text';p.textContent=t(desc||'');
  if(desc&&!opts.showDesc){
    p.style.display='none';
    const btn=document.createElement('button');btn.className='section-help-btn';btn.textContent='i';btn.title=t('更多信息');btn.setAttribute('aria-label',t('更多信息'));
    btn.onclick=e=>{e.stopPropagation();p.style.display=p.style.display==='none'?'block':'none'};
    head.appendChild(btn);
  }
  box.appendChild(head);
  if(desc)box.appendChild(p);
  $('sectionDashboard').appendChild(box);return box;
}
function sectionBookCard(book,subtitle='',targetDocId=null){const card=document.createElement('div');card.className='section-book-card';const title=document.createElement('h3');title.textContent=book.displayTitle||book.title;const meta=document.createElement('p');meta.className='sub';meta.textContent=subtitle||`${langLabel(book.lang)} · ${book.year||''}${book.year?' · ':''}${Number(book.docCount??(book.docs||[]).length)} ${t('文档')} · ${sourceFileName(book.originalFilename||book.manifestName||t('原始文件未知'))}`;const actions=document.createElement('div');actions.className='section-card-actions';const open=document.createElement('button');open.className='btn';open.textContent=t('打开阅读');open.onclick=()=>targetDocId!==null?openDocInBook(book,targetDocId):openBook(book.id);actions.appendChild(open);if(Number(book.docCount??(book.docs||[]).length)>1){const toc=document.createElement('button');toc.className='btn secondary';toc.textContent=t('查看目录');toc.onclick=()=>{openBook(book.id).then(()=>{if(window.innerWidth<1100)$('drawer').style.display='block'})};actions.appendChild(toc)}card.append(title,meta,actions);return card}
function fmtMb(n){const v=Number(n||0);if(v>=1048576)return (v/1048576).toFixed(1)+'MB';if(v>=1024)return (v/1024).toFixed(1)+'KB';return v+'B'}
async function copyText(text){
  if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);return}
  const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
}
function formatDiagnostics(d){
  const lines=[];
  lines.push(`应用 ${d.appVersion} · 数据库 ${d.dbName} v${d.dbVersion}`);
  if(d.storage)lines.push(`存储：已用 ${fmtMb(d.storage.usage)} / 配额 ${fmtMb(d.storage.quota)}${d.storage.persisted?' · 已持久化':' · 未持久化'}`);
  lines.push(`记录：元数据 ${d.counts.bookMeta} · 正文 ${d.counts.bookDocs} · 媒体 ${d.counts.bookAssets} · 辅助 ${d.counts.bookAux} · ${t('原始包')} ${d.counts.bookSources||0}`);
  lines.push(`迁移：${d.migration&&d.migration.done?'已完成':'未完成'}${d.migration&&d.migration.failed&&d.migration.failed.length?` · 失败 ${d.migration.failed.length}`:''}`);
  if(d.pinyin)lines.push(`拼音：开关 ${d.pinyin.enabled?'开':'关'} · 页面 ${d.pinyin.domRt} rt · 当前正文 ${d.pinyin.storedRt??'—'} rt · display ${d.pinyin.computedDisplay||'—'}`);
  lines.push('出版物：');
  if(!d.books.length)lines.push('  （无）');
  for(const b of d.books.slice(0,30)){
    const failed=b.importReport&&Number(b.importReport.failedDocs||0);
    lines.push(`  ${b.legacy?'[旧格式] ':''}${b.title} · ${b.docCount||0} 篇 · ${fmtMb(b.estimatedSize)}${b.hasBible?' · 圣经':''}${b.hasDatedText?' · 每日经文':''}${failed?` · 解码失败 ${failed}`:''}${Number(b.extractsMissingHtml||0)?` · 相关文章缺正文 ${b.extractsMissingHtml}`:''}`);
  }
  if(d.books.length>30)lines.push(`  …另有 ${d.books.length-30} 份`);
  const ev=(d.events||[]).slice(-8);
  lines.push('最近事件：');
  if(!ev.length)lines.push('  （无）');
  for(const e of ev)lines.push(`  ${String(e.at||'').slice(11,19)} ${e.level} ${e.message}`);
  return lines.join('\n');
}
async function renderMoreDashboard(books){
  const settings=sectionPanel(t('阅读设置'),'');
  const pronunciation=document.createElement('button');pronunciation.className='btn secondary';pronunciation.textContent=t('拼音');pronunciation.setAttribute('data-pinyin-toggle','');pronunciation.setAttribute('aria-pressed',pronunciationOn?'true':'false');pronunciation.classList.toggle('active',pronunciationOn);pronunciation.onclick=()=>setPinyin(!pronunciationOn);settings.appendChild(pronunciation);
  const contentLang=document.createElement('button');contentLang.className='btn secondary';contentLang.textContent=t('内容语言');contentLang.onclick=()=>showContentLangMenu(contentLang);settings.appendChild(contentLang);
  const uiLangLabel=document.createElement('div');uiLangLabel.className='sub';uiLangLabel.style.cssText='width:100%;margin-top:4px';uiLangLabel.textContent=t('界面语言');settings.appendChild(uiLangLabel);
  const uiLangRow=document.createElement('div');uiLangRow.className='toolbar';uiLangRow.style.margin='0';settings.appendChild(uiLangRow);
  Object.entries(UI_LANGS).forEach(([code,info])=>{const b=document.createElement('button');b.type='button';b.className='btn secondary'+(code===uiLang?' active':'');b.textContent=info.name;b.onclick=()=>setUiLang(code);uiLangRow.appendChild(b)});
  const categoryMgr=document.createElement('button');categoryMgr.className='btn secondary';categoryMgr.textContent=t('分类管理');categoryMgr.onclick=()=>showCategoryManager(categoryMgr);settings.appendChild(categoryMgr);
  const keepSource=document.createElement('button');keepSource.className='btn secondary'+(keepSourceEnabled()?' active':'');keepSource.textContent=t('保留原始包以便分享');keepSource.setAttribute('aria-pressed',keepSourceEnabled()?'true':'false');keepSource.onclick=()=>{const on=!keepSourceEnabled();setKeepSource(on);keepSource.classList.toggle('active',on);keepSource.setAttribute('aria-pressed',on?'true':'false');say(t('保留原始包以便分享'),on?t('开启后，导入的 PUB 会在应用内保留完整原始文件，便于以后逐字节导出 JWPUB。会占用更多空间。'):t('已关闭原始包保存；已保存的原始包不会被删除。'))};settings.appendChild(keepSource);
  const langPack=document.createElement('button');langPack.className='btn secondary';langPack.textContent=t('导入语言包');langPack.onclick=()=>{const f=$('languagePackInput');if(f)f.click()};settings.appendChild(langPack);
  const diagPanel=sectionPanel(t('系统诊断'),'');
  const diagBox=document.createElement('div');diagBox.className='status';diagBox.style.cssText='white-space:pre-wrap;font-size:12px;max-height:320px;overflow:auto;background:#f6f8f9;border:1px solid #e3e8ea;border-radius:8px;padding:10px;margin:8px 0';
  diagPanel.appendChild(diagBox);
  const diagActions=document.createElement('div');diagActions.className='manage-actions';
  const mkDiagBtn=(label,fn)=>{const b=document.createElement('button');b.className='mini-action';b.textContent=label;b.onclick=fn;return b};
  let lastDiag=null;
  const renderDiag=async()=>{diagBox.textContent=t('正在读取诊断信息…');try{lastDiag=await buildDiagnostics();diagBox.textContent=formatDiagnostics(lastDiag)}catch(e){diagBox.textContent=t('读取诊断信息失败：')+(e.message||e)}};
  diagActions.append(
    mkDiagBtn(t('刷新'),()=>renderDiag()),
    mkDiagBtn(t('拼音自检'),()=>{const d=pinyinDebug();say(t('拼音自检'),Object.entries(d).map(([k,v])=>`${k}: ${v===null?'—':v}`).join('\n'))}),
    mkDiagBtn(t('复制诊断'),async()=>{try{if(!lastDiag)lastDiag=await buildDiagnostics();await copyText(JSON.stringify(lastDiag,null,2));say(t('已复制'),'诊断信息已复制到剪贴板。')}catch(e){say(t('复制失败'),e.message||String(e))}}),
    mkDiagBtn(t('下载诊断'),async()=>{try{if(!lastDiag)lastDiag=await buildDiagnostics();download(new Blob([JSON.stringify(lastDiag,null,2)],{type:'application/json'}),'offline-library-diagnostics.json')}catch(e){say(t('导出失败'),e.message||String(e))}}),
    mkDiagBtn(t('清理旧版冗余'),async()=>{if(!(await askConfirm(t('清理旧版冗余'),'清理已被新版本取代的旧正文/媒体记录？不会删除当前版本。')))return;try{const n=await cleanOldGenerations();await renderDiag();say(t('清理完成'),`已检查 ${n} 份出版物。`)}catch(e){say(t('清理失败'),e.message||String(e))}})
  );
  diagPanel.appendChild(diagActions);
  renderDiag();
}

let renderQueue=Promise.resolve();
function renderSection(filter){
  const next=()=>doRenderSection(filter);
  renderQueue=renderQueue.then(next,next).catch(e=>console.error('render section failed',e));
  return renderQueue;
}
async function doRenderSection(filter){
  const all=await allBooks();await loadCustomCategories();
  const books=all.filter(bookInContentFilter);
  const q=String(filter!==undefined&&filter!==null?filter:'').trim().toLowerCase();
  const nonLibrary=primarySection!=='library';
  $('sectionDashboard').style.display=nonLibrary?'block':'none';const _lsb=$('librarySearchBtn');if(_lsb)_lsb.style.display=nonLibrary?'none':'';
  if(nonLibrary){
    $('sectionDashboard').innerHTML='';$('libraryTabs').style.display='none';try{$('contentLangBar').style.display='none'}catch(e){}
    $('importToolbar').style.display='none';
    $('categories').innerHTML='';$('books').innerHTML='';$('breadcrumbs').style.display='none';
    $('empty').style.display='none';$('count').textContent='';$('listHeading').textContent='';
  }
  if(primarySection==='history')renderContentLangBar();
  if(primarySection==='home')return renderHome(books);
  if(primarySection==='bible')return renderBibleHome(all);
  if(primarySection==='meetings')return renderMeetings(books);
  if(primarySection==='study')return renderStudy(books);
  if(primarySection==='history'){ $('libraryTitle').textContent=t('阅读历史');$('librarySubtitle').textContent=t('点击任意记录直接回到上次阅读的文章和位置。');return renderHistory(books); }
  if(primarySection==='more'){ $('libraryTitle').textContent=t('更多');$('librarySubtitle').textContent=t('导入、备份、诊断和设置。');return renderMoreDashboard(books); }
  return renderLibrary(books,q);
}
async function renderLibrary(books,q){
  const _lsb=$('librarySearchBtn');if(_lsb)_lsb.style.display='';
  $('sectionDashboard').style.display='none';$('libraryTabs').style.display='flex';$('importToolbar').style.display='none';renderContentLangBar();
  document.querySelectorAll('#libraryTabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===libraryTab));
  let visible=books.filter(b=>bookMatches(b,q));
  $('libraryTitle').textContent=libraryTab==='favorites'?t('收藏'):t('多媒体图书馆');
  $('librarySubtitle').textContent='';
  clearLibraryLists();$('breadcrumbs').innerHTML='';$('breadcrumbs').style.display='none';
  if(libraryTab==='favorites')visible=visible.filter(b=>b.favorite);
  if(libraryTab==='favorites'){
    $('listHeading').textContent=t('我的收藏');visible.forEach(addBookCard);
  }else if(q){
    $('listHeading').textContent=t('搜索结果');visible.forEach(addBookCard);
  }else{
    const trail=categoryTrail.slice();
    if(trail.length){$('breadcrumbs').style.display='flex';const all=document.createElement('button');all.textContent=t('全部类别');all.onclick=()=>{categoryTrail=[];renderSection()};$('breadcrumbs').appendChild(all);trail.forEach((name,i)=>{const sep=document.createElement('span');sep.textContent='›';$('breadcrumbs').appendChild(sep);const btn=document.createElement('button');btn.textContent=catLabel(name);btn.onclick=()=>{categoryTrail=trail.slice(0,i+1);renderSection()};$('breadcrumbs').appendChild(btn)});}
    const counts=categoryCounts(visible,trail);const order=['bible','books','magazines','brochures','meetings','reference','daily','songs','other','uncategorized'];const names=[...counts.keys()].sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||String(catLabel(a)).localeCompare(String(catLabel(b)),uiLocale())});
    names.forEach(name=>addCategoryCard(name,counts.get(name),trail));
    const direct=visible.filter(b=>{const p=categoryPath(b);return p.length===trail.length&&trail.every((x,i)=>p[i]===x)});
    direct.forEach(addBookCard);
    $('listHeading').textContent=trail.length?catLabel(trail[trail.length-1]):t('按类别浏览');
  }
  const totalShown=$('books').children.length+$('categories').children.length;
  $('count').textContent=`${totalShown} ${t('项')}`;
  const empty=totalShown===0;$('empty').style.display=empty?'block':'none';
  if(empty){$('empty').innerHTML=books.length?t('没有找到匹配的出版物。'):t('这里还没有出版物。')+'<br>'+t('点击右上角「更多」，从您的设备选择 PUB 文件。')}
}
async function renderHome(books){
  dailyHomeDirty=false;
  $('libraryTitle').textContent=t('首页');
$('librarySubtitle').textContent=t('今日经文、收藏和最近导入。');
  const dash=$('sectionDashboard');
  const today=new Date();const dateLabel=today.toLocaleDateString(uiLocale(),{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  const daily=await findTodayDaily(books);
  const dailyPanel=sectionPanel(t('今日经文'),'');
  if(daily){
    const d=await getBookDoc(daily.book.id,daily.doc.id);
    const summary=d?extractDailyVerse(d.html):{date:'',verse:''};
    const card=document.createElement('div');card.className='daily-card';
    card.title=t('点击阅读今天全文');
    card.setAttribute('role','link');card.tabIndex=0;
    const open=()=>openDocInBook(daily.book,daily.doc.id);
    card.onclick=open;card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
    const title=document.createElement('div');title.className='daily-title';title.textContent=(summary.date||dateLabel).replace(/(日)(星期)/,'$1 $2');
    const p=document.createElement('p');p.className='daily-text';p.textContent=summary.verse||t('点击阅读今天的经文。');
    card.append(title,p);dailyPanel.appendChild(card);
  }else{
    const e=document.createElement('div');e.className='section-empty';e.innerHTML='<strong>'+t('今天没有可用的每日经文')+'</strong><p>'+t('请导入包含今天日期的每日经文 PUB（例如当年度的“天天查考圣经”）。')+'</p>';dailyPanel.appendChild(e);
  }
  const fav=books.filter(b=>b.favorite).sort((a,b)=>String(a.displayTitle||a.title).localeCompare(String(b.displayTitle||b.title),'zh-CN'));
  const favPanel=sectionPanel(t('收藏'),fav.length?`${fav.length} ${t('份')}`:t('收藏的出版物会显示在这里'));
  if(fav.length)appendBookGrid(favPanel,fav);
  else{const e=document.createElement('div');e.className='section-empty';e.textContent=t('还没有收藏。在出版物卡片上点击“收藏”即可加入这里。');favPanel.appendChild(e)}
  const recent=books.filter(b=>b.importedAt).sort((a,b)=>Number(b.importedAt)-Number(a.importedAt)).slice(0,8);
  const recentPanel=sectionPanel(t('最新导入'),recent.length?`${recent.length} ${t('份')}`:t('还没有资料'));
  if(recent.length)appendBookGrid(recentPanel,recent);
  else{const e=document.createElement('div');e.className='section-empty';e.innerHTML='<strong>'+t('还没有资料')+'</strong><p>'+t('导入 PUB 后会显示在这里。')+'</p>';recentPanel.appendChild(e)}
}
async function renderBibleHome(books){
  $('libraryTitle').textContent=t('圣经');$('librarySubtitle').textContent=t('选择译本、经卷和章节；其他出版物中的经文链接也会使用这里的本地经文。');
  const versions=orderedBibles(books);
  if(!versions.length){
    const panel=sectionPanel(t('圣经'),t('导入圣经 PUB 后即可在这里按经卷阅读。'));
    const e=document.createElement('div');e.className='section-empty';e.innerHTML='<strong>'+t('还没有导入圣经')+'</strong><p>'+t('支持《新世界译本》等 PUB。')+'</p>';panel.appendChild(e);return;
  }
  let saved=null;try{saved=localStorage.getItem('offlineLibraryBibleId')}catch(e){}
  let target=versions.find(v=>v.id===currentBibleId)||versions.find(v=>v.id===saved)||versions[0];
  currentBibleId=target.id;
  const panel=sectionPanel(t('圣经'),t('选择经卷、章节或栏目'));
  const head=panel.querySelector('.section-panel-head');
  if(versions.length>1){
    const menuBtn=document.createElement('button');menuBtn.className='section-help-btn';menuBtn.innerHTML=svgIcon('more',18);menuBtn.title=t('切换/排序圣经译本');menuBtn.setAttribute('aria-label',t('切换圣经译本'));
    const menu=document.createElement('div');menu.className='bible-version-menu';menu.style.display='none';
    versions.forEach((v,idx)=>{
      const row=document.createElement('div');row.className='bible-version-row';
      const b=document.createElement('button');b.className='bible-version-item'+(v.id===target.id?' active':'');b.textContent=`${v.displayTitle||v.title} · ${langLabel(v.lang)}`;
      if(idx===0){const tag=document.createElement('span');tag.className='bible-version-tag';tag.textContent=t('首选');b.appendChild(tag)}
      b.onclick=()=>{currentBibleId=v.id;try{localStorage.setItem('offlineLibraryBibleId',v.id)}catch(e){};bibleSelectedBook=null;bibleSection='正文';renderSection()};
      row.appendChild(b);
      const move=(dir)=>{const ids=versions.map(x=>x.id);const j=idx+dir;if(j<0||j>=ids.length)return;[ids[idx],ids[j]]=[ids[j],ids[idx]];saveBibleOrderIds(ids);renderSection()};
      const up=document.createElement('button');up.className='bible-order-btn';up.innerHTML=svgIcon('up',14);up.disabled=idx===0;up.title=t('上移');up.setAttribute('aria-label',t('上移'));up.onclick=e=>{e.stopPropagation();move(-1)};
      const down=document.createElement('button');down.className='bible-order-btn';down.innerHTML=svgIcon('down',14);down.disabled=idx===versions.length-1;down.title=t('下移');down.setAttribute('aria-label',t('下移'));down.onclick=e=>{e.stopPropagation();move(1)};
      row.append(up,down);menu.appendChild(row);
    });
    menuBtn.onclick=e=>{e.stopPropagation();menu.style.display=menu.style.display==='none'?'block':'none'};
    setTimeout(()=>document.addEventListener('click',()=>{try{menu.style.display='none'}catch(e){}},{once:true}),0);
    head.appendChild(menuBtn);panel.appendChild(menu);
  }
  const cur=document.createElement('div');cur.className='sub bible-current';cur.textContent=`${target.displayTitle||target.title} · ${langLabel(target.lang)}`;
  head.classList.add('bible-panel-head');
  const helpBtn=head.querySelector('.section-help-btn');
  if(helpBtn)head.insertBefore(cur,helpBtn);else head.appendChild(cur);
  const searchBtn=document.createElement('button');searchBtn.className='section-help-btn bible-search-btn';searchBtn.title=t('搜索');searchBtn.setAttribute('aria-label',t('搜索'));searchBtn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.2 4.2"/></svg>';
  searchBtn.onclick=e=>{e.stopPropagation();openReaderSearch({kind:'bible',bookId:target.id,tab:'bible'})};
  if(helpBtn)head.insertBefore(searchBtn,helpBtn);else head.appendChild(searchBtn);
  const full=await loadBookAuxOnly(target.id);
  if(!full){say('无法打开圣经','找不到该出版物的数据。');return;}
  const structure=full.bibleStructure||null;
  const available=new Set(['正文']);
  let tabs=[];
  if(structure){
    if(Array.isArray(structure.tabs)&&structure.tabs.length){
      tabs=[...new Set(structure.tabs.map(x=>bibleTabKey(x.title)).filter(Boolean))];
    }
    if(Array.isArray(structure.intro)&&structure.intro.length)available.add('简介');
    if(Array.isArray(structure.search)&&structure.search.length)available.add('检索');
    for(const [k,label] of [['appendixA','附录A'],['appendixB','附录B'],['appendixC','附录C']])if(Array.isArray(structure[k])&&structure[k].length)available.add(label);
  }else{
    const roots=full.toc.filter(t=>t.depth===0&&normBibleTitle(t.title)).map(t=>bibleTabKey(t.title));
    for(const t of roots)if(BIBLE_TABS.includes(t))available.add(t);
  }
  if(!tabs.length)tabs=BIBLE_TABS.filter(t=>available.has(t));
  tabs=tabs.filter(t=>t==='正文'||available.has(t)||!BIBLE_TABS.includes(t));
  tabs=['正文',...tabs.filter(t=>t!=='正文')];
  if(!tabs.includes(bibleSection))bibleSection='正文';
  const bar=document.createElement('div');bar.className='bible-tabs';
  tabs.forEach(tb=>{const b=document.createElement('button');b.className='bible-tab'+(tb===bibleSection?' active':'');b.textContent=t(tb);b.onclick=()=>{bibleSection=tb;bibleSelectedBook=null;renderSection()};bar.appendChild(b)});
  panel.appendChild(bar);
  if(bibleSection==='正文')renderBibleBooks(panel,full);
  else renderBibleDocs(panel,full,bibleSection);
}
function renderBibleBooks(panel,full){
  const data=full.bibleData||{};const names=data.bookNames||{};
  const chapterKeys=Object.keys(data.chapterIndex&&Object.keys(data.chapterIndex).length?data.chapterIndex:(data.chapters||{}));
  const byBook=new Map();
  for(const k of chapterKeys){const parts=k.split(':');const bn=Number(parts[0]),ch=Number(parts[1]);if(!Number.isFinite(bn)||!Number.isFinite(ch))continue;if(!byBook.has(bn))byBook.set(bn,[]);if(!byBook.get(bn).includes(ch))byBook.get(bn).push(ch)}
  const bookNumbers=[...new Set(Object.keys(names).map(Number).concat([...byBook.keys()]))].filter(n=>Number.isFinite(n)&&n>0&&n<=66).sort((a,b)=>a-b);
  if(!bookNumbers.length){const e=document.createElement('div');e.className='section-empty';e.textContent=t('这个译本没有提供经卷目录。');panel.appendChild(e);return;}
  if(bibleSelectedBook){
    const bn=Number(bibleSelectedBook);
    const chs=(byBook.get(bn)||[]).sort((a,b)=>a-b);
    const back=document.createElement('button');back.className='btn secondary';back.innerHTML=svgIcon('left',16)+' '+t('全部经卷');back.onclick=()=>{bibleSelectedBook=null;renderSection()};panel.appendChild(back);
    const h=document.createElement('h3');h.className='bible-group-title bible-book-title';h.textContent=`${names[bn]||('第'+bn+'卷')} · ${bookAbbr(bn,full.lang)} · ${t('共')} ${chs.length} ${t('章')}`;panel.appendChild(h);
    const info=(full.bibleStructure&&full.bibleStructure.books||[]).find(x=>Number(x.num)===bn);
    if(info&&(info.introDocId||info.outlineDocId)){
      const acts=document.createElement('div');acts.className='section-card-actions';
      if(info.introDocId){const b=document.createElement('button');b.className='btn secondary';b.textContent=t('本书简介');b.onclick=()=>openDocInBook(full,info.introDocId,'','bible');acts.appendChild(b)}
      if(info.outlineDocId){const b=document.createElement('button');b.className='btn secondary';b.textContent=t('内容大纲');b.onclick=()=>openDocInBook(full,info.outlineDocId,'','bible');acts.appendChild(b)}
      panel.appendChild(acts);
    }
    if(!chs.length){const e=document.createElement('div');e.className='section-empty';e.textContent=t('这个译本没有提供章节正文。');panel.appendChild(e)}
    else{
      const grid=document.createElement('div');grid.className='chapter-grid';
      chs.forEach(ch=>{const b=document.createElement('button');b.className='chapter-btn';b.textContent=ch;b.onclick=()=>openBibleChapterReader(full.id,bn,ch,0,'bible');grid.appendChild(b)});
      panel.appendChild(grid);
    }
    return;
  }
  const makeGroup=(title,list)=>{
    if(!list.length)return;
    const h=document.createElement('h3');h.className='bible-group-title';h.textContent=title;
    const grid=document.createElement('div');grid.className='bible-book-grid';
    list.forEach(bn=>{const btn=document.createElement('button');btn.className='bible-book group-'+bookGroupKey(bn);btn.innerHTML=`<strong>${safeText(bookAbbr(bn,full.lang))}</strong><small>${safeText(names[bn]||('第'+bn+'卷'))}</small>`;btn.onclick=()=>{bibleSelectedBook=bn;renderSection()};grid.appendChild(btn)});
    panel.append(h,grid);
  };
  makeGroup(t('希伯来语及阿拉米语经卷'),bookNumbers.filter(n=>n<=39));
  makeGroup(t('希腊语经卷'),bookNumbers.filter(n=>n>39));
}

function renderBibleDocs(panel,full,section){
  const structure=full.bibleStructure||null;
  if(structure){
    const map={'简介':structure.intro,'检索':structure.search,'附录A':structure.appendixA,'附录B':structure.appendixB,'附录C':structure.appendixC};
    const docs=Array.isArray(map[section])?map[section]:[];
    if(docs.length){
      const list=document.createElement('div');list.className='bible-doc-list';
      docs.forEach(item=>{const b=document.createElement('button');b.className='bible-doc-item';b.textContent=item.title||'文档';b.onclick=()=>openDocInBook(full,item.docId,'','bible');list.appendChild(b)});
      panel.appendChild(list);return;
    }
  }
  const start=full.toc.findIndex(t=>t.depth===0&&bibleTabKey(t.title)===section);
  const items=[];
  if(start>=0){const root=full.toc[start];if(root.docId!==null)items.push(root);for(let i=start+1;i<full.toc.length&&full.toc[i].depth>0;i++){if(full.toc[i].docId!==null)items.push(full.toc[i])}}
  if(!items.length){const e=document.createElement('div');e.className='section-empty';e.textContent=t('这个栏目没有可显示的内容。');panel.appendChild(e);return}
  const list=document.createElement('div');list.className='bible-doc-list';
  items.forEach(item=>{const b=document.createElement('button');b.className='bible-doc-item';b.textContent=item.title||'文档';b.onclick=()=>openDocInBook(full,item.docId,'','bible');list.appendChild(b)});
  panel.appendChild(list);
}

const MONTH_NUMBERS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
function monthNumber(name){return MONTH_NUMBERS[String(name||'').toLowerCase()]||0}
function parseWeekRange(title,fallbackYear){
  const s=String(title||'').replace(/[\u200b-\u200d]/g,'').replace(/[（(][^）)]*[）)]/g,' ').replace(/\s+/g,' ').trim();
  const fallback=Number(fallbackYear)||new Date().getFullYear();
  let m=s.match(/(?:(\d{4})\s*[年년]\s*)?(\d{1,2})\s*[月월]\s*(\d{1,2})\s*[日일]?\s*(?:[-~～至–—]|부터)\s*(?:(\d{4})\s*[年년]\s*)?(?:(\d{1,2})\s*[月월]\s*)?(\d{1,2})\s*[日일]?/);
  if(m){
    const sy=Number(m[1]||fallback),sm=Number(m[2]),sd=Number(m[3]),em=Number(m[5]||sm),ed=Number(m[6]);
    if(sm>=1&&sm<=12&&em>=1&&em<=12&&sd>=1&&sd<=31&&ed>=1&&ed<=31){
      let ey=Number(m[4]||sy);if(!m[4]&&em<sm)ey=sy+1;
      return {start:sy*10000+sm*100+sd,end:ey*10000+em*100+ed};
    }
  }
  m=s.match(/(?:(\d{4})\s+)?([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\s*(?:[-–—~]|to)\s*(?:([A-Za-z]{3,9})\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i);
  if(m){
    const sm=monthNumber(m[2]),em=monthNumber(m[5]||m[2]),sd=Number(m[3]),ed=Number(m[6]);
    if(sm&&em&&sd>=1&&sd<=31&&ed>=1&&ed<=31){
      const sy=Number(m[1]||m[4]||fallback);let ey=Number(m[7]||sy);if(!m[7]&&em<sm)ey=sy+1;
      return {start:sy*10000+sm*100+sd,end:ey*10000+em*100+ed};
    }
  }
  return null;
}
function extractMeetingParts(html){
  try{
    const doc=new DOMParser().parseFromString(String(html||''),'text/html');
    doc.querySelectorAll('rt,rp,script,style,figure,img').forEach(n=>n.remove());
    const out=[];
    doc.querySelectorAll('h2,h3').forEach(el=>{
      const title=(el.textContent||'').replace(/[\u200b-\u200d]/g,'').replace(/\s+/g,' ').trim();
      if(!title)return;
      out.push({tag:el.tagName.toLowerCase(),title,anchor:el.id||''});
    });
    return out;
  }catch(e){return []}
}
async function loadMeetingWeeks(items){
  const todayKey=dateKey(new Date());
  let fallback=null;
  for(const b of items){
    const full=await loadBook(b.id);if(!full)continue;
    const weekDocs=full.docs.filter(d=>!d.datedText&&Number(d.documentClass)===106);
    const weekIds=new Set(weekDocs.map(d=>String(d.id)));
    const dated=(full.datedTexts||[]).filter(dt=>weekIds.has(String(dt.documentId))&&Number(dt.firstDateOffset)>0);
    let weeks=dated.map(dt=>{const doc=weekDocs.find(d=>String(d.id)===String(dt.documentId));return doc?{doc,range:{start:dateOffsetKey(dt.firstDateOffset,full.year),end:dateOffsetKey(dt.lastDateOffset||dt.firstDateOffset,full.year)}}:null}).filter(x=>x&&x.range.start&&x.range.end);
    if(!weeks.length)weeks=weekDocs.map(d=>({doc:d,range:parseWeekRange(d.title,full.year)})).filter(x=>x.range);
    if(!weeks.length)continue;
    weeks.sort((a,b)=>a.range.start-b.range.start);
    const data={book:full,weeks};
    if(weeks.some(w=>todayKey>=w.range.start&&todayKey<=w.range.end))return data;
    if(!fallback)fallback=data;
  }
  return fallback;
}

async function watchtowerArticlesFor(book){
  const metaArticles=Array.isArray(book.watchtowerStudyArticles)?book.watchtowerStudyArticles:[];
  if(metaArticles.length&&metaArticles.every(a=>Number(a.firstDateOffset)>0))return metaArticles;
  const full=await loadBook(book.id);if(!full)return metaArticles;
  const datedByDoc=new Map((full.datedTexts||[]).map(dt=>[String(dt.documentId),dt]));
  const datedRows=(full.datedTexts||[]).filter(dt=>Number(dt.firstDateOffset)>0).sort((a,b)=>Number(a.firstDateOffset)-Number(b.firstDateOffset));
  const docs=(full.docs||[]).filter(d=>Number(d.documentClass)===40&&!d.datedText).sort((a,b)=>Number(a.id)-Number(b.id));
  const out=docs.map(d=>{const dt=datedByDoc.get(String(d.id));return {docId:d.id,mepsId:Number(d.mepsId||0),title:d.title||'',contextTitle:d.contextTitle||plainText(d.contextTitleRich||''),firstDateOffset:dt?Number(dt.firstDateOffset):null,lastDateOffset:dt?Number(dt.lastDateOffset??dt.firstDateOffset):null}});
  // Study-edition JWPUBs often attach every DatedText row to the table of
  // contents document instead of each STUDY ARTICLE document. Pair the dated
  // rows with the articles in reading order so existing imports still show the
  // current week without being re-imported.
  if(!out.some(a=>Number(a.firstDateOffset)>0)&&datedRows.length&&docs.length){
    const directlyMatched=datedRows.some(dt=>docs.some(d=>String(d.id)===String(dt.documentId)));
    if(!directlyMatched){const n=Math.min(datedRows.length,docs.length);for(let i=0;i<n;i++){out[i].firstDateOffset=Number(datedRows[i].firstDateOffset);out[i].lastDateOffset=Number(datedRows[i].lastDateOffset??datedRows[i].firstDateOffset)}}
  }
  return out.length?out:metaArticles;
}
async function findWatchtowerStudy(books){
  const todayKey=dateKey(new Date());const all=[];
  for(const b of books){
    if(!(Array.isArray(b.watchtowerStudyArticles)||String(b.publicationType||'').toLowerCase().includes('watchtower')||/watchtower|study/.test(String(categoryPath(b)[1]||''))))continue;
    const arts=await watchtowerArticlesFor(b);
    for(const a of arts){const range=(a.firstDateOffset&&a.lastDateOffset)?{start:dateOffsetKey(a.firstDateOffset,b.year),end:dateOffsetKey(a.lastDateOffset,b.year)}:parseWeekRange(String(a.contextTitle||'').replace(/[\u200b-\u200d]/g,''),b.year);if(range)all.push({book:b,article:a,range})}
  }
  all.sort((a,b)=>a.range.start-b.range.start);
  return all.find(x=>todayKey>=x.range.start&&todayKey<=x.range.end)||all.find(x=>x.range.start>=todayKey)||all[all.length-1]||null;
}
async function renderWatchtowerMeetings(books){
  const wt=await findWatchtowerStudy(books);
  const wtPanel=sectionPanel(t('守望台研经班聚会'),'');
  if(wt){
    const rangeLabel=wt.range&&dailyDateLabel(wt.range.start)&&dailyDateLabel(wt.range.end)?`${dailyDateLabel(wt.range.start)} – ${dailyDateLabel(wt.range.end)}`:'';
    const wtDateLabel=rangeLabel||String(wt.article.contextTitle||'').replace(/[\u200b-\u200d]/g,'');
    const row=document.createElement('button');row.className='wt-study-link';
    row.innerHTML=`<span class="wt-date">${safeText(wtDateLabel)}</span><span class="wt-title">${safeText(wt.article.title||'')}</span>`;
    row.onclick=()=>openDocInBook(wt.book,wt.article.docId,'','meetings');
    wtPanel.appendChild(row);
  }else{
    const e=document.createElement('div');e.className='section-empty';e.textContent=t('导入《守望台》研读版后，这里会显示最近的研经文章日期和链接。');wtPanel.appendChild(e);
  }
}
async function renderMeetings(books){
  $('libraryTitle').textContent=t('聚会');
  $('librarySubtitle').textContent=t('本周聚会安排、聚会工作手册和其他聚会资料。');
  const today=new Date();
  const dateLabel=today.toLocaleDateString(uiLocale(),{year:'numeric',month:'long',day:'numeric',weekday:'long'});
  const items=books.filter(b=>categoryPath(b)[0]==='meetings').sort((a,b)=>Number(b.year||0)-Number(a.year||0)||Number(b.issue||0)-Number(a.issue||0)||Number(b.importedAt||0)-Number(a.importedAt||0));
  if(!items.length){
    const panel=sectionPanel(t('传道与生活聚会'),'');
    const e=document.createElement('div');e.className='section-empty';e.innerHTML='<strong>'+t('还没有聚会资料')+'</strong><p>'+t('导入聚会工作手册 PUB 后，这里会显示本周要学习的内容。')+'</p>';panel.appendChild(e);
    await renderWatchtowerMeetings(books);
    return;
  }
  const data=await loadMeetingWeeks(items);
  if(!data){
    const panel=sectionPanel(t('传道与生活聚会'),'');
    appendBookGrid(panel,[items[0]]);
    if(items.length>1){const rest=sectionPanel(t('其他聚会资料'),`${t('共')} ${items.length-1} ${t('份')}`);appendBookGrid(rest,items.slice(1))}
    await renderWatchtowerMeetings(books);
    return;
  }
  const todayKey=dateKey(today);
  let currentIndex=data.weeks.findIndex(w=>todayKey>=w.range.start&&todayKey<=w.range.end);
  if(currentIndex<0){const upcoming=data.weeks.findIndex(w=>w.range.start>todayKey);currentIndex=upcoming>=0?upcoming:data.weeks.length-1}
  if(meetingBookId!==data.book.id){meetingBookId=data.book.id;meetingWeekDocId=null}
  let idx=data.weeks.findIndex(w=>String(w.doc.id)===String(meetingWeekDocId));
  if(idx<0)idx=currentIndex;
  const week=data.weeks[idx];
  meetingWeekDocId=week.doc.id;
  const isToday=todayKey>=week.range.start&&todayKey<=week.range.end;
  const panel=sectionPanel(t('传道与生活聚会'),'');
  const bar=document.createElement('button');bar.type='button';bar.className='meeting-collapse-bar';bar.innerHTML=`<span class="mc-date">${safeText(week.doc.title)}${isToday?' · '+t('今天'):''}</span><span class="mc-arrow">${meetingsExpanded?svgIcon('up',16):svgIcon('down',16)}</span>`;bar.onclick=()=>{meetingsExpanded=!meetingsExpanded;renderSection()};panel.appendChild(bar);
  if(meetingsExpanded){
  const nav=document.createElement('div');nav.className='meeting-week-nav';
  const prev=document.createElement('button');prev.innerHTML=svgIcon('left',16)+' '+t('上一周');prev.disabled=idx<=0;prev.onclick=()=>{if(idx>0){meetingWeekDocId=data.weeks[idx-1].doc.id;renderSection()}};
  const label=document.createElement('div');label.className='meeting-week-label';label.innerHTML=`${safeText(week.doc.title)}${isToday?'<span class="meeting-today-badge">'+t('今天')+'</span>':''}`;
  const next=document.createElement('button');next.innerHTML=t('下一周')+svgIcon('right',16);next.disabled=idx>=data.weeks.length-1;next.onclick=()=>{if(idx<data.weeks.length-1){meetingWeekDocId=data.weeks[idx+1].doc.id;renderSection()}};
  nav.append(prev,label,next);panel.appendChild(nav);
  const parts=extractMeetingParts(week.doc.html);
  if(parts.length){
    const list=document.createElement('div');list.className='meeting-part-list';
    parts.forEach(p=>{
      const b=document.createElement('button');b.className='meeting-part '+(p.tag==='h2'?'section':'part');
      b.innerHTML=`<span class="meeting-part-tag">${p.tag==='h2'?t('部分'):t('环节')}</span><span>${safeText(p.title)}</span>`;
      b.onclick=()=>openDocInBook(data.book,week.doc.id,p.anchor?'#'+p.anchor:'','meetings');
      list.appendChild(b);
    });
    panel.appendChild(list);
  }else{
    appendBookGrid(panel,[data.book]);
  }
  }
  await renderWatchtowerMeetings(books);
  const others=items.filter(b=>b.id!==data.book.id);
  if(others.length){const rest=sectionPanel(t('其他聚会资料'),`${t('共')} ${others.length} ${t('份')}`);appendBookGrid(rest,others)}
}

async function showHistoryPanel(){
  const all=await allBooks();const visible=all.filter(bookInContentFilter);const ids=new Set(visible.map(b=>b.id));
  const hs=(await reqP(tx('history').getAll())).filter(h=>ids.has(h.bookId)).sort((a,b)=>Number(b.openedAt||0)-Number(a.openedAt||0)).slice(0,100);
  const list=$('historyList');list.innerHTML='';
  if(!hs.length){const e=document.createElement('div');e.className='section-empty';e.textContent=t('还没有阅读记录。阅读文章后会自动记录');list.appendChild(e)}
  else hs.forEach(h=>{
    const row=document.createElement('button');row.className='manage-row';
    row.innerHTML=`<span><strong>${safeText(h.bookTitle||t('出版物'))}</strong><small>${safeText(h.title||'')} · ${new Date(Number(h.openedAt||0)).toLocaleString(uiLocale())}</small></span><span>${t('打开 ›')}</span>`;
    row.onclick=async()=>{closeHistoryPanel();const b=await loadBook(h.bookId);if(!b){say('无法打开','对应出版物可能已被删除。');return}await openDocInBook(b,h.docId);restoreReaderScroll(h.scrollTop)};
    list.appendChild(row);
  });
  rememberPanelFocus($('historyPanel'));$('historyPanel').classList.add('show');setTimeout(()=>focusSafely($('historyClose')),0);
}
function closeHistoryPanel(){const p=$('historyPanel');p.classList.remove('show');restorePanelFocus(p)}
async function renderHistory(books){
  const ids=new Set((books||[]).map(b=>b.id));
  const hs=(await reqP(tx('history').getAll())).filter(h=>!ids.size||ids.has(h.bookId)).sort((a,b)=>Number(b.openedAt||0)-Number(a.openedAt||0));
  const panel=sectionPanel(t('最近阅读'),hs.length?`${t('共')} ${hs.length} ${t('项')}`:t('还没有阅读记录。阅读文章后会自动记录'));
  if(!hs.length){
    const e=document.createElement('div');e.className='section-empty';e.textContent=t('阅读任意文章后，这里会自动生成可点击的阅读记录。');panel.appendChild(e);return;
  }
  const list=document.createElement('div');list.className='history-list';
  hs.slice(0,120).forEach(h=>{
    const row=document.createElement('button');row.className='manage-row';
    const left=document.createElement('span');
    left.innerHTML=`<strong>${safeText(h.bookTitle||t('出版物'))}</strong><small>${safeText(h.title||'')} · ${new Date(Number(h.openedAt||0)).toLocaleString(uiLocale())}</small>`;
    const right=document.createElement('span');right.textContent=t('打开 ›');
    row.append(left,right);
    row.onclick=async()=>{
      const b=await loadBook(h.bookId);
      if(!b){say('无法打开','对应出版物可能已被删除。');return}
      await openDocInBook(b,h.docId,'','history');
      restoreReaderScroll(h.scrollTop);
    };
    list.appendChild(row);
  });
  panel.appendChild(list);
}
function noteIdForNew(){return 'note-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)}
function studyTagMap(){return new Map(studyState.tags.map(t=>[t.id,t]))}
function noteDisplayTitle(n){return String(n.title||'').trim()||t('无标题笔记')}
function notePreview(n){return String(n.text||'').replace(/\s+/g,' ').trim()}
async function createStudyTag(name){
  const clean=String(name||'').trim();if(!clean)return null;
  const existing=studyState.tags.find(t=>String(t.name||'').toLowerCase()===clean.toLowerCase());
  if(existing)return existing;
  const tag={id:'tag-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:clean,createdAt:Date.now()};
  await saveTag(tag);studyState.tags.push(tag);return tag;
}
function renderStudyTagBar(container){
  container.innerHTML='';
  const tags=[...studyState.tags].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),uiLocale()));
  tags.forEach(tag=>{
    const chip=document.createElement('div');chip.className='study-tag'+(studyState.tagFilter.has(tag.id)?' active':'');
    const name=document.createElement('button');name.type='button';name.className='study-tag-name';name.textContent=tag.name;
    name.onclick=()=>{if(studyState.tagFilter.has(tag.id))studyState.tagFilter.delete(tag.id);else studyState.tagFilter.add(tag.id);renderStudyTagBar(container);renderStudyNotes()};
    const more=document.createElement('button');more.type='button';more.className='study-tag-more';more.innerHTML=svgIcon('more',18);more.title=t('标签操作');more.setAttribute('aria-label',t('标签操作'));
    more.onclick=e=>{e.stopPropagation();showTagActions(tag,more)};
    chip.append(name,more);container.appendChild(chip);
  });
  const form=document.createElement('form');form.className='study-add-tag';
  const input=document.createElement('input');input.placeholder=t('新标签');input.setAttribute('aria-label',t('新标签'));
  const add=document.createElement('button');add.type='submit';add.textContent='+';
  form.onsubmit=async e=>{e.preventDefault();const tag=await createStudyTag(input.value);input.value='';if(tag)renderStudy(studyState.books)};
  form.append(input,add);container.appendChild(form);
}
function showTagActions(tag,anchor){
  closeBookActions();
  const menu=document.createElement('div');menu.id='bookActionMenu';menu.className='book-action-menu';
  const title=document.createElement('div');title.className='book-action-title';title.textContent=tag.name;menu.appendChild(title);
  const del=document.createElement('button');del.className='book-action delete';del.innerHTML=svgIcon('trash',18)+'<span></span>';del.lastChild.textContent=t('删除标签');
  del.onclick=async e=>{e.stopPropagation();closeBookActions();if(!(await askConfirm(t('删除标签'),`删除标签“${tag.name}”？笔记中的这个标签也会移除。`)))return;await deleteTagCascade(tag.id);studyState.tagFilter.delete(tag.id);studyState.tags=studyState.tags.filter(t=>t.id!==tag.id);renderStudy(studyState.books)};
  menu.appendChild(del);document.body.appendChild(menu);positionBookMenu(menu,anchor);
  bookMenuOpenedAt=Date.now();
}
function noteTagChips(note,map){
  const box=document.createElement('div');box.className='note-tags';
  (Array.isArray(note.tagIds)?note.tagIds:[]).forEach(id=>{const tag=map.get(id);if(!tag)return;const s=document.createElement('span');s.textContent=tag.name;box.appendChild(s)});
  return box;
}
function noteRow(note,map){
  const row=document.createElement('div');row.className='swipe-row note-swipe';
  const card=document.createElement('div');card.className='note-card';card.tabIndex=0;
  const head=document.createElement('div');head.className='note-card-head';
  const h=document.createElement('h3');h.textContent=noteDisplayTitle(note);
  const more=document.createElement('button');more.type='button';more.className='note-more';more.innerHTML=svgIcon('more',18);more.title=t('笔记操作');more.setAttribute('aria-label',t('笔记操作'));
  more.onclick=e=>{e.stopPropagation();showNoteActions(note,more)};
  head.append(h,more);
  const preview=document.createElement('p');preview.className='note-preview';preview.textContent=notePreview(note)||t('（无正文）');
  const tags=noteTagChips(note,map);
  card.append(head,preview,tags);
  const del=document.createElement('button');del.type='button';del.className='swipe-delete';del.textContent=t('删除');
  del.onclick=async e=>{e.stopPropagation();await deleteNoteWithConfirm(note)};
  row.append(card,del);
  let startX=null,startY=null,open=false;
  const setOpen=v=>{open=v;card.style.transform=v?'translateX(-78px)':'';};
  card.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.touches[0];startX=t.clientX;startY=t.clientY;},{passive:true});
  card.addEventListener('touchmove',e=>{if(startX==null)return;const t=e.touches[0],dx=t.clientX-startX,dy=t.clientY-startY;if(Math.abs(dy)>40&&Math.abs(dy)>Math.abs(dx)){startX=null;return}if(Math.abs(dx)>10)card.style.transform=`translateX(${Math.max(-78,Math.min(0,open?-78+dx:dx))}px)`;},{passive:true});
  card.addEventListener('touchend',e=>{if(startX==null)return;const t=e.changedTouches[0],dx=t.clientX-startX;startX=null;setOpen(dx<-42||(open&&dx<20));},{passive:true});
  card.addEventListener('click',e=>{if(e.target.closest('.note-more'))return;if(open){e.preventDefault();setOpen(false);return}openNoteEditor(note)});
  return row;
}
function showNoteActions(note,anchor){
  closeBookActions();
  const menu=document.createElement('div');menu.id='bookActionMenu';menu.className='book-action-menu';
  const edit=document.createElement('button');edit.className='book-action';edit.innerHTML=svgIcon('pencil',18)+'<span></span>';edit.lastChild.textContent=t('编辑笔记');edit.onclick=e=>{e.stopPropagation();closeBookActions();openNoteEditor(note)};menu.appendChild(edit);
  if(note.bookId&&note.docId){const open=document.createElement('button');open.className='book-action';open.innerHTML=svgIcon('right',18)+'<span></span>';open.lastChild.textContent=t('打开原文');open.onclick=async e=>{e.stopPropagation();closeBookActions();const b=await loadBook(note.bookId);if(b)await openDocInBook(b,note.docId,'','study')};menu.appendChild(open)}
  const del=document.createElement('button');del.className='book-action delete';del.innerHTML=svgIcon('trash',18)+'<span></span>';del.lastChild.textContent=t('删除');del.onclick=async e=>{e.stopPropagation();closeBookActions();await deleteNoteWithConfirm(note)};menu.appendChild(del);
  document.body.appendChild(menu);positionBookMenu(menu,anchor);bookMenuOpenedAt=Date.now();
}
async function deleteNoteWithConfirm(note){
  if(!(await askConfirm(t('删除'),`删除笔记“${noteDisplayTitle(note)}”？高亮会保留。`)))return;
  await deleteNoteCascade(note.id);
  studyState.notes=studyState.notes.filter(n=>n.id!==note.id);
  renderStudy(studyState.books);
}
function renderStudyNotes(){
  const list=$('studyNoteList');if(!list)return;
  const q=String(studyState.query||'').trim().toLowerCase();
  const map=studyTagMap();
  const notes=studyState.notes.filter(n=>{
    const tagText=(Array.isArray(n.tagIds)?n.tagIds:[]).map(id=>{const tg=map.get(id);return tg?tg.name:''}).join(' ');
    if(q&&!((n.title||'')+' '+(n.text||'')+' '+tagText).toLowerCase().includes(q))return false;
    if(studyState.tagFilter.size){const ids=Array.isArray(n.tagIds)?n.tagIds:[];if(![...studyState.tagFilter].every(id=>ids.includes(id)))return false}
    return true;
  }).sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
  list.innerHTML='';
  if(!notes.length){const e=document.createElement('div');e.className='section-empty';e.textContent=studyState.query||studyState.tagFilter.size?t('没有找到匹配的笔记'):t('还没有笔记。阅读文章时可以添加笔记。');list.appendChild(e);return}
  notes.forEach(n=>list.appendChild(noteRow(n,map)));
}
function editorTagPicker(container,selectedIds,onChange){
  container.innerHTML='';
  [...studyState.tags].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),uiLocale())).forEach(tag=>{
    const b=document.createElement('button');b.type='button';b.className='study-tag'+(selectedIds.has(tag.id)?' active':'');b.textContent=tag.name;
    b.onclick=()=>{if(selectedIds.has(tag.id))selectedIds.delete(tag.id);else selectedIds.add(tag.id);editorTagPicker(container,selectedIds,onChange);onChange([...selectedIds])};
    container.appendChild(b);
  });
  const form=document.createElement('form');form.className='study-add-tag';
  const listId='tagList-'+Date.now()+'-'+Math.random().toString(36).slice(2,6);
  const dl=document.createElement('datalist');dl.id=listId;
  studyState.tags.forEach(t=>{const o=document.createElement('option');o.value=t.name;dl.appendChild(o)});
  const input=document.createElement('input');input.placeholder=t('搜索或新建标签');input.setAttribute('list',listId);
  const add=document.createElement('button');add.type='submit';add.textContent='+';
  form.onsubmit=async e=>{e.preventDefault();const tag=await createStudyTag(input.value);input.value='';if(tag){selectedIds.add(tag.id);editorTagPicker(container,selectedIds,onChange);onChange([...selectedIds])}};
  form.append(input,add,dl);container.appendChild(form);
}
function noteEditorTitle(note){return String((note&&note.title)||'').trim()||t('无标题笔记')}
function noteEditorSnapshot(state){return {title:state.titleEl?state.titleEl.value:'',text:state.textEl?state.textEl.value:'',tags:[...(state.selected||[])]}}
function showNoteDock(note){
  const dock=$('noteDock');if(!dock)return;
  dock.classList.add('show');$('noteDockOpen').textContent=noteEditorTitle(note);
}
function hideNoteDock(){$('noteDock')?.classList.remove('show')}
function applyNoteSnapshot(state,snap){
  if(!state.titleEl||!state.textEl)return;
  state.titleEl.value=snap.title;state.textEl.value=snap.text;state.selected=new Set(snap.tags||[]);
  editorTagPicker(state.tagBox,state.selected,()=>{});
}
function pushNoteHistory(state){
  if(!state.titleEl||!state.textEl)return;
  const snap=noteEditorSnapshot(state),last=state.history[state.index];
  if(last&&last.title===snap.title&&last.text===snap.text&&last.tags.join('|')===snap.tags.join('|'))return;
  state.history=state.history.slice(0,state.index+1);state.history.push(snap);state.index=state.history.length-1;
}
async function persistNoteDraft(){
  const state=noteEditorState;if(!state)return null;
  const titleValue=state.titleEl?state.titleEl.value.trim():'';
  const textValue=state.textEl?state.textEl.value.trim():'';
  const tagIds=[...(state.selected||[])];
  if(!titleValue&&!textValue&&!tagIds.length&&!state.note.id)return null;
  const n={...(state.note||{}),title:titleValue,text:textValue,tagIds,updatedAt:Date.now(),createdAt:(state.note&&state.note.createdAt)||Date.now()};
  if(!n.id)n.id=noteIdForNew();
  if(!n.title)n.title=n.text.split('\n')[0].slice(0,40)||t('无标题笔记');
  await saveOne('notes',n);state.note=n;
  const ix=studyState.notes.findIndex(x=>x.id===n.id);if(ix>=0)studyState.notes[ix]=n;else studyState.notes.push(n);
  return n;
}
async function closeNoteEditor(){
  if(!noteEditorState)return;
  const returnFocus=noteEditorState.returnFocus;
  try{await persistNoteDraft()}catch(e){console.warn('保存笔记失败',e)}
  noteEditorState=null;hideNoteDock();renderStudy(studyState.books);restoreFocus(returnFocus);
}
async function minimizeNoteEditor(render=true){
  if(!noteEditorState)return;
  const state=noteEditorState;
  let n=null;try{n=await persistNoteDraft()}catch(e){console.warn('保存笔记失败',e)}
  state.minimized=true;state.shell?.remove();showNoteDock(n||state.note||{});
  if(render)renderStudy(studyState.books);
}
function openNoteEditor(note){
  const dash=$('sectionDashboard');dash.innerHTML='';
  let state=noteEditorState;
  if(!state||!state.minimized||(note&&state.note.id&&String(note.id)!==String(state.note.id))){
    state={note:note?{...note}:{},selected:new Set(Array.isArray(note&&note.tagIds)?note.tagIds:[]),history:[],index:-1,minimized:false,saveTimer:null,histTimer:null};
    noteEditorState=state;
  }else{
    state.minimized=false;
  }
  const shell=document.createElement('section');shell.className='note-editor';shell.id='noteEditor';state.returnFocus=document.activeElement;shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label',t('笔记'));state.shell=shell;
  const head=document.createElement('div');head.className='note-editor-head';
  const min=document.createElement('button');min.type='button';min.className='iconbtn';min.innerHTML=svgIcon('collapse',20);min.title=t('收起');min.setAttribute('aria-label',t('收起'));min.onclick=()=>minimizeNoteEditor(true);
  const spacer=document.createElement('div');spacer.className='note-head-spacer';
  const undoIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h9a6 6 0 0 1 0 12h-1"/></svg>';
  const redoIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9h-9a6 6 0 0 0 0 12h1"/></svg>';
  const undo=document.createElement('button');undo.type='button';undo.className='iconbtn note-icon-btn';undo.innerHTML=undoIcon;undo.title=t('撤销');undo.setAttribute('aria-label',t('撤销'));undo.onclick=()=>{if(state.index>0){state.index--;applyNoteSnapshot(state,state.history[state.index])}};
  const redo=document.createElement('button');redo.type='button';redo.className='iconbtn note-icon-btn';redo.innerHTML=redoIcon;redo.title=t('前进');redo.setAttribute('aria-label',t('前进'));redo.onclick=()=>{if(state.index<state.history.length-1){state.index++;applyNoteSnapshot(state,state.history[state.index])}};
  const close=document.createElement('button');close.type='button';close.className='iconbtn';close.innerHTML=svgIcon('close',18);close.title=t('关闭');close.setAttribute('aria-label',t('关闭'));close.onclick=closeNoteEditor;
  head.append(min,spacer,undo,redo,close);
  const title=document.createElement('input');title.className='note-input';title.placeholder=t('标题');title.value=state.note.title||'';
  const text=document.createElement('textarea');text.className='note-textarea';text.placeholder=t('写笔记…');text.value=state.note.text||'';
  const tagLabel=document.createElement('div');tagLabel.className='sub';tagLabel.textContent=t('标签');
  const tagBox=document.createElement('div');tagBox.className='study-tagbar editor-tags';
  state.titleEl=title;state.textEl=text;state.tagBox=tagBox;
  const schedule=()=>{
    clearTimeout(state.saveTimer);state.saveTimer=setTimeout(async()=>{try{await persistNoteDraft()}catch(e){console.warn('保存笔记失败',e)}},500);
    clearTimeout(state.histTimer);state.histTimer=setTimeout(()=>pushNoteHistory(state),350);
  };
  title.oninput=schedule;text.oninput=schedule;
  editorTagPicker(tagBox,state.selected,()=>{pushNoteHistory(state);schedule()});
  shell.addEventListener('keydown',e=>{
    if(!(e.ctrlKey||e.metaKey))return;
    const k=String(e.key||'').toLowerCase();
    if(k==='z'&&!e.shiftKey){if(state.index>0){e.preventDefault();state.index--;applyNoteSnapshot(state,state.history[state.index]);schedule()}}
    else if((k==='z'&&e.shiftKey)||k==='y'){if(state.index<state.history.length-1){e.preventDefault();state.index++;applyNoteSnapshot(state,state.history[state.index]);schedule()}}
  });
  if(!state.history.length){state.history.push(noteEditorSnapshot(state));state.index=0}
  const footer=document.createElement('div');footer.className='note-editor-footer';footer.append(tagLabel,tagBox);
  shell.append(head,title,text,footer);dash.appendChild(shell);
  hideNoteDock();
  setTimeout(()=>focusSafely(title),0);
  // The editor is sized to the viewport; starting from the list's old scroll
  // position would push the tag footer underneath the fixed bottom navigation.
  try{window.scrollTo(0,0)}catch(e){}
}
async function renderStudy(books){
  studyState.books=books;
  try{$('libraryTitle').textContent=t('个人研读');$('librarySubtitle').textContent=''}catch(e){}
  const dash=$('sectionDashboard');dash.innerHTML='';
  const [tags,notes]=await Promise.all([allTags(),reqP(tx('notes').getAll())]);
  studyState.tags=tags||[];
  studyState.notes=(notes||[]).filter(n=>n.kind!=='answer');
  const shell=document.createElement('section');shell.className='study-shell';
  const toolbar=document.createElement('div');toolbar.className='study-toolbar';
  const search=document.createElement('input');search.className='search study-search';search.placeholder=t('搜索标题、正文或标签');search.value=studyState.query||'';
  search.oninput=()=>{studyState.query=search.value;renderStudyNotes()};
  const add=document.createElement('button');add.type='button';add.className='iconbtn study-add-note';add.innerHTML=svgIcon('plus',18);add.title=t('新建笔记');add.onclick=()=>openNoteEditor(null);
  toolbar.append(search,add);
  const tagbar=document.createElement('div');tagbar.className='study-tagbar';tagbar.id='studyTagBar';
  const list=document.createElement('div');list.className='study-note-list';list.id='studyNoteList';
  shell.append(toolbar,tagbar,list);dash.appendChild(shell);
  renderStudyTagBar(tagbar);
  renderStudyNotes();
}

async function renderBooks(filter=''){return renderSection(filter)}
document.querySelectorAll('#bottomNav button[data-primary]').forEach(btn=>btn.onclick=()=>onNavTap(btn.dataset.primary));
document.querySelectorAll('[data-reader-primary]').forEach(btn=>btn.onclick=()=>{
  const sourceTab=readerSessionTab||readerOriginSection||readerNavSection||primarySection;
  if($('reader').style.display==='block'&&currentBook)storeReaderView(sourceTab,true);
  cancelReaderPositionRestore();$('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid';readerReturnTarget=null;readerReturnSection=null;readerOriginSection=null;readerSessionTab=null;readerSearchReturn=null;bibleMode=false;bibleReturn=null;setBibleToolbar(false);onNavTap(btn.dataset.readerPrimary);
});
const _noteDockOpen=$('noteDockOpen');if(_noteDockOpen)_noteDockOpen.onclick=async()=>{if(!noteEditorState)return;await setPrimaryNav('study',{skipRestore:true});openNoteEditor(noteEditorState.note)};
const moreBtn=$('moreBtn');if(moreBtn)moreBtn.onclick=()=>showSystemMenu(moreBtn);
document.getElementById('historyClose').onclick=closeHistoryPanel;
document.addEventListener('click',e=>{
  if($('historyPanel').classList.contains('show')&&!$('historyPanel').contains(e.target)&&!e.target.closest('#historyBtn'))closeHistoryPanel();
  const bm=document.getElementById('bookActionMenu');
  if(bm&&!bm.contains(e.target)&&Date.now()-bookMenuOpenedAt>80)bm.remove();
  const lm=document.getElementById('langMenu');
  if(lm&&!lm.contains(e.target)&&Date.now()-langMenuOpenedAt>80)lm.remove();
  const cl=document.getElementById('contentLangMenu');
  if(cl&&!cl.contains(e.target))cl.remove();
  const rl=document.getElementById('readerLangMenu');
  if(rl&&!rl.contains(e.target)&&!e.target.closest('#readerLangBtn'))rl.remove();
  const cm=document.getElementById('categoryManagerMenu');
  if(cm&&!cm.contains(e.target))cm.remove();
});

const HELP_TEXT_ZH='这是一个单文件离线图书馆。底部导航依次是首页、圣经、多媒体图书馆、聚会和个人研读。单击栏目回到上次位置，双击回到该栏目顶部。导入：点右上角「更多」，选择设备中的 PUB 文件；新文件默认勾选，已导入的文件默认不勾选。备份与恢复：定期导出完整备份，恢复前会先确认。界面语言用顶部语言按钮切换；阅读时可用左右方向键翻页。';
function showHelp(){say(t('使用说明'),uiLang==='zh'?HELP_TEXT_ZH:t('使用说明内容'))}
function showSystemMenu(anchor,view){
  closeBookActions();
  const menu=document.createElement('div');menu.id='bookActionMenu';menu.className='book-action-menu';
  const add=(label,fn,icon)=>{const b=document.createElement('button');b.className='book-action';b.innerHTML=svgIcon(icon,18)+'<span>'+t(label)+'</span>';b.onclick=e=>{e.stopPropagation();closeBookActions();fn()};menu.appendChild(b)};
  const reopen=(next)=>{closeBookActions();showSystemMenu(anchor,next)};
  if(view==='backup'){
    add('备份笔记',()=>backupNotes(),'download');
    add('恢复笔记',()=>startRestore('notes'),'upload');
    add('备份整个图书馆',()=>backupLibrary(),'download');
    add('恢复整个图书馆',()=>startRestore('library'),'upload');
    add('返回',()=>reopen(''),'left');
  }else if(view==='settings'){
    add('系统诊断',()=>setPrimaryNav('more'),'search');
    add('设置与关于',()=>showAbout(),'settings');
    add('返回',()=>reopen(''),'left');
  }else{
    add('导入 PUB',()=>$('fileInput').click(),'plus');
    add('备份与恢复',()=>reopen('backup'),'download');
    add('使用说明',()=>showHelp(),'help');
    add('设置与诊断',()=>reopen('settings'),'settings');
  }
  document.body.appendChild(menu);positionBookMenu(menu,anchor);bookMenuOpenedAt=Date.now();
}

async function deletePublication(book){
 const [notes,marks,history]=await Promise.all([reqP(tx('notes').getAll()),reqP(tx('bookmarks').getAll()),reqP(tx('history').getAll())]);
 const stores=['books','bookMeta','bookAux','notes','bookmarks','history'];const t=idb.transaction(stores,'readwrite');
 t.objectStore('books').delete(book.id);t.objectStore('bookMeta').delete(book.id);t.objectStore('bookAux').delete(book.id);for(const n of notes)if(n.bookId===book.id)t.objectStore('notes').delete(n.id);
 for(const m of marks)if(m.bookId===book.id)t.objectStore('bookmarks').delete(m.id);for(const h of history)if(h.bookId===book.id)t.objectStore('history').delete(h.id);
 await new Promise((res,rej)=>{t.oncomplete=res;t.onerror=()=>rej(t.error)});
 try{await deleteBookData(book.id)}catch(e){console.warn('删除正文/媒体记录失败',e)}
 try{await deleteBookSource(book.id)}catch(e){console.warn('删除原始包失败',e)}
 clearUrls(book.id);if(currentBook?.id===book.id){closeLinkPopover();clearUrls();currentBook=null;readerReturnTarget=null;readerOriginSection=null;readerSessionTab=null;readerReturnSection=null;$('reader').style.display='none';$('home').style.display='block';$('bottomNav').style.display='grid'}
}
async function recordHistory(book,doc,scrollTop){
 const id=`${book.id}:${doc.id}`;const old=await getOne('history',id);
 await saveOne('history',{id,bookId:book.id,docId:doc.id,title:doc.title,bookTitle:book.displayTitle||book.title,scrollTop:Number(scrollTop||0),openedAt:Date.now(),originalFilename:book.originalFilename||book.manifestName||''});
}
