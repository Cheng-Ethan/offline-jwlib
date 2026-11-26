const JWPUB_MAX_BYTES=380*1024*1024;
const JWPUB_MAX_INNER_FILES=8000;
const JWPUB_MAX_DOC_BYTES=48*1024*1024;
const JWPUB_MAX_FAIL_RATIO=0.6;
function pubSizeMb(n){return (Number(n||0)/1048576).toFixed(1)}
function zipMagicHex(u8,n=8){return Array.from(u8.subarray(0,Math.min(n,u8.length))).map(b=>b.toString(16).padStart(2,'0')).join(' ')}
function zipHasEocd(u8){for(let i=u8.length-22;i>=0;i--){if(u8[i]===0x50&&u8[i+1]===0x4b&&u8[i+2]===0x05&&u8[i+3]===0x06)return true}return false}
function zipHasLocalHeader(u8){return u8.length>=4&&u8[0]===0x50&&u8[1]===0x4b&&u8[2]===0x03&&u8[3]===0x04}
function rebuildZipFromLocalHeaders(u8){
  const len=u8.length,dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  const u16=o=>dv.getUint16(o,true),u32=o=>dv.getUint32(o,true),td=new TextDecoder('utf-8');
  const SIG_LOCAL=0x04034b50,entries=[];
  let off=0,lastEnd=0;
  while(off+30<=len&&u32(off)===SIG_LOCAL){
    const flags=u16(off+6),method=u16(off+8),time=u16(off+10),date=u16(off+12);
    const crc=u32(off+14),csize=u32(off+18),usize=u32(off+22);
    const nameLen=u16(off+26),extraLen=u16(off+28);
    if(flags&0x08)return null;
    if(csize===0xffffffff||usize===0xffffffff)return null;
    const nameStart=off+30,dataStart=nameStart+nameLen+extraLen,dataEnd=dataStart+csize;
    if(dataStart>len||dataEnd>len)return null;
    entries.push({flags,method,time,date,crc,csize,usize,offset:off,nameBytes:u8.subarray(nameStart,nameStart+nameLen)});
    off=dataEnd;lastEnd=off;
  }
  if(!entries.length||!lastEnd)return null;
  const cdParts=[];let cdSize=0;
  for(const e of entries){
    const rec=new Uint8Array(46+e.nameBytes.length),rv=new DataView(rec.buffer);
    const w16=(o,v)=>rv.setUint16(o,v,true),w32=(o,v)=>rv.setUint32(o,v,true);
    w32(0,0x02014b50);w16(4,20);w16(6,20);w16(8,e.flags);w16(10,e.method);w16(12,e.time);w16(14,e.date);
    w32(16,e.crc);w32(20,e.csize);w32(24,e.usize);w16(28,e.nameBytes.length);w16(30,0);w16(32,0);w16(34,0);w16(36,0);w32(38,0);w32(42,e.offset);
    rec.set(e.nameBytes,46);
    cdParts.push(rec);cdSize+=rec.length;
  }
  const eocd=new Uint8Array(22),ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);
  ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);
  ev.setUint32(12,cdSize,true);ev.setUint32(16,lastEnd,true);ev.setUint16(20,0,true);
  const out=new Uint8Array(lastEnd+cdSize+22);
  out.set(u8.subarray(0,lastEnd),0);
  let p=lastEnd;for(const c of cdParts){out.set(c,p);p+=c.length}
  out.set(eocd,p);
  return out;
}
async function fileToBytes(file){
  if(file instanceof Uint8Array)return file;
  if(file instanceof ArrayBuffer)return new Uint8Array(file);
  if(file&&typeof file.arrayBuffer==='function')return new Uint8Array(await file.arrayBuffer());
  if(file&&file.buffer instanceof ArrayBuffer)return new Uint8Array(file.buffer,file.byteOffset||0,file.byteLength||file.buffer.byteLength);
  throw new Error('无法读取文件内容。');
}
async function loadJwpubArchive(file){
  const name=(file&&file.name)||'PUB 文件';
  const u8=await fileToBytes(file);
  if(!u8.length)throw new Error(`${name} 是空文件（0 字节），请重新获取。`);
  if(zipHasEocd(u8))return JSZip.loadAsync(u8);
  if(zipHasLocalHeader(u8)){
    const repaired=rebuildZipFromLocalHeaders(u8);
    if(repaired)return JSZip.loadAsync(repaired);
    throw new Error(`文件不完整：${name} 以 ZIP 头开始，但缺少中央目录（可能下载或传输没有完成）。当前 ${pubSizeMb(u8.length)} MB，文件头 ${zipMagicHex(u8)}。请重新获取完整的 .pub 文件。`);
  }
  throw new Error(`这不是有效的 PUB：${name} 的文件头是 ${zipMagicHex(u8)}，应为 50 4b 03 04。文件可能被保存成网页、文本，或下载未完成。`);
}
async function parseJwpub(file,onProgress,opts){
  const captureSource=!!(opts&&opts.captureSource);
  if(!window.JSZip)throw new Error('内置 PUB 压缩包组件未能加载，请重新打开完整的单文件 HTML。');
  if(!window.initSqlJs)throw new Error('SQLite 组件未能加载，请重新打开完整的单文件 HTML。');
  onProgress('正在读取 PUB 压缩包…');
  if(file&&Number(file.size||0)>JWPUB_MAX_BYTES)throw new Error(`文件过大：${pubSizeMb(file.size)} MB。当前浏览器版本单次最多处理 ${pubSizeMb(JWPUB_MAX_BYTES)} MB 的 PUB。`);
  const outer=await loadJwpubArchive(file);
  const manifestFile=outer.file('manifest.json');
  if(!manifestFile)throw new Error('找不到 manifest.json；这可能不是标准 PUB 文件。');
  const manifestBytes=await manifestFile.async('uint8array');
  const manifest=JSON.parse(new TextDecoder('utf-8').decode(manifestBytes));
  let inner=outer;
  const contents=outer.file('contents');
  if(contents){const data=await contents.async('uint8array');if(data[0]===0x50&&data[1]===0x4b)inner=await JSZip.loadAsync(data);}
  const innerNames=Object.keys(inner.files);
  if(innerNames.length>JWPUB_MAX_INNER_FILES)throw new Error(`压缩包内文件过多（${innerNames.length} 个），已停止导入以保护浏览器内存。`);
  onProgress('正在定位 SQLite 数据库…');
  let dbEntry=null;
  const preferred=manifest.publication&&manifest.publication.fileName;
  if(preferred&&inner.file(preferred))dbEntry=inner.file(preferred);
  if(!dbEntry){for(const [name,entry] of Object.entries(inner.files)){if(!entry.dir&&/\.(db|sqlite|sqlite3)$/i.test(name)){dbEntry=entry;break}}}
  if(!dbEntry)throw new Error('压缩包中没有找到数据库文件。');
  const dbName=dbEntry.name||preferred||'publication.db';
  let dbBytes=await dbEntry.async('uint8array');
  const sourceDbBytes=captureSource?dbBytes:null;
  SQL=SQL||await initSqlJs();
  const db=new SQL.Database(dbBytes);
  dbBytes=null;
  const pubRows=rows(db,'Publication');
  if(!pubRows.length)throw new Error('数据库中没有 Publication 记录。');
  const p=pubRows[0];
  const mp=manifest.publication||{};
  const categoryRows=rows(db,'PublicationCategory');
  const categoryCodes=[...new Set([...categoryRows.map(r=>String(pick(r,['Category'],'')||'')).filter(Boolean),...(Array.isArray(mp.categories)?mp.categories.map(String):[])])];
  const categorySymbol=String(pick(p,['PublicationCategorySymbol'],categoryCodes[0]||'')||'');
  const pub={
    lang:Number(pick(p,['MepsLanguageIndex','LanguageIndex','Language'],mp.language??0)),
    symbol:String(pick(p,['Symbol','PublicationSymbol'],mp.symbol||'unknown')),
    undatedSymbol:String(pick(p,['UndatedSymbol'],mp.undatedSymbol||'')),
    uniqueSymbol:String(pick(p,['UniqueSymbol'],mp.uniqueSymbol||'')),
    englishSymbol:String(pick(p,['EnglishSymbol'],mp.englishSymbol||'')),
    uniqueEnglishSymbol:String(pick(p,['UniqueEnglishSymbol'],mp.uniqueEnglishSymbol||'')),
    year:Number(pick(p,['Year'],mp.year||0)),
    issue:Number(pick(p,['IssueTagNumber'],mp.issueNumber||0)),
    publicationCategorySymbol:categorySymbol,
    categoryCodes,
    manifestHash:String(mp.hash||''),
    manifestTimestamp:String(mp.timestamp||''),
    title:String(pick(p,['Title','Name'],mp.title||manifest.name||file.name)),
    displayTitle:String(mp.displayTitle||mp.title||manifest.name||file.name),
    shortTitle:String(mp.shortTitle||mp.title||''),
    publicationType:String(mp.publicationType||''),
    manifestType:Number(mp.type||0),
    issueId:Number(mp.issueId||0),
    categories:Array.isArray(mp.categories)?mp.categories:[],
    attributes:Array.isArray(mp.attributes)?mp.attributes:[],
    schemaVersion:Number(mp.schemaVersion||0),
    firstDatedTextDateOffset:Number(pick(p,['FirstDatedTextDateOffset'],0)),
    manifestRaw:manifest
  };
  const ki=await keyIv(pub);
  const importReport={startedAt:Date.now(),failedDocs:0,failedExtracts:0,failedDated:0,failedCommentary:0,decodeModes:{},warnings:[]};
  const noteMode=m=>{importReport.decodeModes[m]=(importReport.decodeModes[m]||0)+1};
  onProgress('正在解密正文…');
  const docRows=rows(db,'Document');
  const totalDocRows=docRows.length;
  const documentMetadataRows=rows(db,'DocumentMetadata');
  // Bible publications keep the verse text in dedicated tables, not Document.Content.
  // The index is read from the publication itself; no hard-coded versification table.
  let bibleData=null;
  // Keep the reference/link metadata from EVERY publication, even when it is not
  // itself a Bible publication. A normal publication can contain jwpub://b/ links
  // and BibleCitation rows without carrying the BibleVerse text table.
  const hyperlinkRows=rows(db,'Hyperlink');
  const hyperlinkById=new Map(hyperlinkRows.map(h=>[String(pick(h,['HyperlinkId'],'')),String(pick(h,['Link'],''))]));
  const refPublicationRows=rows(db,'RefPublication');
  const refPublicationById=new Map(refPublicationRows.map(r=>[String(pick(r,['RefPublicationId'],'')),r]));
  const citationRows=rows(db,'BibleCitation');
  const bibleVerseRows=rows(db,'BibleVerse');
  const bibleChapterRows=rows(db,'BibleChapter');
  // Read packaged extracts as well as full documents.
  const extractRows=rows(db,'Extract');
  const documentExtractRows=rows(db,'DocumentExtract');
  const paragraphCommentaryRows=rows(db,'ParagraphCommentary');
  const verseCommentaryRows=rows(db,'VerseCommentary');
  const datedTextRows=rows(db,'DatedText');
  const dbTableNames=(()=>{try{const q=db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");return q.length?q[0].values.map(r=>String(r[0])):[]}catch(e){return []}})();
  const bibleLinkRows=hyperlinkRows.filter(h=>/^jwpub:\/\/b\//i.test(String(pick(h,['Link'],''))));
  const databaseInfo={
    tables:dbTableNames,
    hyperlinkRows:hyperlinkRows.length,
    bibleLinkRows:bibleLinkRows.length,
    bibleCitationRows:citationRows.length,
    bibleVerseRows:bibleVerseRows.length,
    bibleChapterRows:bibleChapterRows.length,
    extractRows:extractRows.length,
    documentExtractRows:documentExtractRows.length,
    paragraphCommentaryRows:paragraphCommentaryRows.length,
    verseCommentaryRows:verseCommentaryRows.length,
    datedTextRows:datedTextRows.length,
    bibleLinkExamples:bibleLinkRows.slice(0,5).map(h=>String(pick(h,['Link'],'')))
  };
  // DocumentExtract associates a source document with an Extract record.
  // Extract.Content is encrypted like Document.Content and can be rendered offline.
  const extractJoin=new Map();
  for(const de of documentExtractRows){
    const id=String(pick(de,['ExtractId','Id'],''));
    if(!extractJoin.has(id))extractJoin.set(id,[]);
    extractJoin.get(id).push(de);
  }
  const extracts=[];
  for(const er of extractRows){
    const id=String(pick(er,['ExtractId','Id'],''));
    const related=extractJoin.get(id)||[null];
    const blob=bytes(pick(er,['Content','Html','HTML','Data'],null));
    let html='';
    if(blob){try{const r=await decryptContentAny(blob,ki);html=r.html;noteMode(r.mode)}catch(e){importReport.failedExtracts++;console.warn('无法解密摘录',id,e)}}
    if(!html){const plain=pick(er,['Html','HTML','Text'],null);if(typeof plain==='string')html=plain;}
    if(!html)continue;
    for(const de of related){
      const meta={...(er||{}),...(de||{})};
      // DocumentExtract.HyperlinkId is the link that actually appears in the
      // citing paragraph. Extract.Link is usually the same, but some
      // publications leave it empty or use another language prefix, so keep
      // both the source link and the canonical target fields.
      const sourceLink=String(hyperlinkById.get(String(pick(de||{},['HyperlinkId'],'')))||'').trim();
      const rawLink=String(pick(meta,['Link','Href','URL'],pick(er,['Link','Href','URL'],''))||'').trim();
      // Real Extract tables use RefMepsDocumentId / RefMepsDocumentClass /
      // RefBeginParagraphOrdinal / RefEndParagraphOrdinal. Older/other schemas
      // use RefDocID / RefClass / RefBegin / RefEnd, so accept both.
      const refDocId=Number(pick(meta,['RefMepsDocumentId','RefDocID','ReferencedDocumentId'],pick(er,['RefMepsDocumentId','RefDocID'],0))||0);
      const refPublicationId=Number(pick(meta,['RefPublicationId'],pick(er,['RefPublicationId'],0))||0);
      const refPub=refPublicationById.get(String(refPublicationId))||{};
      const refSymbol=String(pick(meta,['RefSymbol','PublicationSymbol'],pick(er,['RefSymbol'],''))||pick(refPub,['Symbol'],'')||'').trim();
      const refEnglishSymbol=String(pick(refPub,['EnglishSymbol','UniqueEnglishSymbol','RootSymbol'],'')||'').trim();
      const refUndated=String(pick(meta,['RefUndated'],pick(er,['RefUndated'],''))||pick(refPub,['UndatedSymbol'],'')||'').trim();
      const refIssue=Number(pick(meta,['RefIssue'],pick(er,['RefIssue'],0))||pick(refPub,['IssueTagNumber','IssueNumber'],0)||0);
      const refTitle=String(pick(refPub,['ReferenceTitle','DisplayTitle','Title','ShortTitle'],'')||'').trim();
      const refBegin=Number(pick(meta,['RefBeginParagraphOrdinal','RefBegin','BeginParagraph','FirstParagraph'],pick(er,['RefBeginParagraphOrdinal','RefBegin'],0))||0);
      const refEnd=Number(pick(meta,['RefEndParagraphOrdinal','RefEnd','EndParagraph','LastParagraph'],pick(er,['RefEndParagraphOrdinal','RefEnd'],refBegin))||refBegin);
      const generatedLink=(refEnglishSymbol||refSymbol)&&refDocId>0
        ?`p/${refEnglishSymbol||refSymbol}:${refDocId}${refBegin>0?`/${refBegin}${refEnd>refBegin?`-${refEnd}`:''}`:''}`
        :'';
      let link=rawLink||sourceLink||generatedLink;
      if(/^p\//i.test(link))link='jwpub://'+link;
      else if(/^\/p\//i.test(link))link='jwpub:/'+link;
      const caption=String(pick(meta,['Caption','CaptionRich','Title','Label'],pick(er,['Caption','CaptionRich','Title','Label'],''))||'');
      const captionText=caption.replace(/<[^>]+>/g,' ').replace(/[\s\u200b]+/g,' ').trim();
      // `html` is the decrypted Extracts.Content. Without storing it here the
      // link opens a popover with a title but no article text.
      extracts.push({id:`${id}:${String(pick(de||{},['DocumentId','DocId'],''))}`,extractId:id,sourceDocId:Number(pick(de||{},['DocumentId','DocId'],0)),link,sourceLink,html,caption,captionText,refDocId,refSymbol,refEnglishSymbol,refBegin,refEnd,refPublicationId,refClass:Number(pick(meta,['RefMepsDocumentClass','RefClass'],pick(er,['RefMepsDocumentClass','RefClass'],0))||0),refUndated,refIssue,refTitle,beginPid:Number(pick(meta,['BeginPID','BeginParagraphNumber','BeginParagraphOrdinal','ParagraphNumber'],0)),endPid:Number(pick(meta,['EndPID','EndParagraphNumber','EndParagraphOrdinal','LastParagraphNumber'],0)),sort:Number(pick(meta,['Sort','SortOrder','ViewOrder'],0))});
    }
  }
  extractRows.length=0;documentExtractRows.length=0;
  const datedTexts=[];
  for(const row of datedTextRows){
    const blob=bytes(pick(row,['Content'],null));let html='';
    if(blob){try{const r=await decryptContentAny(blob,ki);html=r.html;noteMode(r.mode)}catch(e){importReport.failedDated++}}
    if(!html)continue;
    datedTexts.push({id:Number(pick(row,['DatedTextId','Id'],0)),documentId:Number(pick(row,['DocumentId'],0)),link:String(pick(row,['Link'],'')),firstDateOffset:Number(pick(row,['FirstDateOffset'],0)),lastDateOffset:Number(pick(row,['LastDateOffset'],pick(row,['FirstDateOffset'],0))),caption:String(pick(row,['CaptionRich','Caption','Title'],'每日经文')||'每日经文'),html,beginParagraphOrdinal:Number(pick(row,['BeginParagraphOrdinal'],0)),endParagraphOrdinal:Number(pick(row,['EndParagraphOrdinal'],0))});
  }
  datedTextRows.length=0;
  const commentaries=[];
  for(const [kind,list] of [['paragraph',paragraphCommentaryRows],['verse',verseCommentaryRows]]){
    for(const row of list){
      const blob=bytes(pick(row,['Content'],null));let html='';
      if(blob){try{const r=await decryptContentAny(blob,ki);html=r.html;noteMode(r.mode)}catch(e){importReport.failedCommentary++}}
      if(!html)continue;
      commentaries.push({id:Number(pick(row,[kind==='paragraph'?'ParagraphCommentaryId':'VerseCommentaryId','Id'],0)),kind,label:String(pick(row,['Label','Title'],kind==='paragraph'?'段落注释':'经文注释')||''),html,commentaryMepsDocumentId:Number(pick(row,['CommentaryMepsDocumentId'],0)),beginParagraphOrdinal:Number(pick(row,['BeginParagraphOrdinal'],0)),endParagraphOrdinal:Number(pick(row,['EndParagraphOrdinal'],0)),commentaryType:Number(pick(row,['CommentaryType'],0))});
    }
  }
  if(bibleVerseRows.length||bibleChapterRows.length){
    const verseRows=[],verseIndex={},refs={},chapters={},chapterRows=[],chapterIndex={},bookNames={};
    for(const r of bibleVerseRows){
      const id=Number(pick(r,['BibleVerseId'],NaN)),blob=bytes(pick(r,['Content'],null));
      if(!Number.isFinite(id)||!blob)continue;
      verseIndex[id]=verseRows.length;
      verseRows.push({id,label:String(pick(r,['Label'],'')),content:blob});
    }
    const hyperlinkById=new Map(hyperlinkRows.map(h=>[String(pick(h,['HyperlinkId'],'')),String(pick(h,['Link'],''))]));
    for(const c of citationRows){
      const href=hyperlinkById.get(String(pick(c,['HyperlinkId'],'')))||'';
      const m=href.match(/^jwpub:\/\/b\/([A-Za-z0-9]+)\/(\d+):(\d+):(\d+)/i);
      const verseId=Number(pick(c,['FirstBibleVerseId'],NaN));
      if(m&&Number.isFinite(verseId)){
        const key=`${Number(m[2])}:${Number(m[3])}:${Number(m[4])}`;
        if(refs[key]===undefined)refs[key]=verseId;
      }
    }
    for(const c of bibleChapterRows){
      const book=Number(pick(c,['BookNumber'],NaN)),chapter=Number(pick(c,['ChapterNumber'],NaN));
      const first=Number(pick(c,['FirstVerseId'],NaN)),last=Number(pick(c,['LastVerseId'],NaN));
      if(Number.isFinite(book)&&Number.isFinite(chapter)&&Number.isFinite(first)&&Number.isFinite(last)){
        const firstRow=verseRows[verseIndex[first]];
        const firstNumbered=firstRow&&String(firstRow.label||'').trim()===''&&first<last?first+1:first;
        chapters[`${book}:${chapter}`]={firstVerseId:first,firstNumberedVerseId:firstNumbered,lastVerseId:last};
      }
      // BibleChapter.Content is the full chapter HTML (encrypted). Keep it
      // encrypted and decrypt on demand, like BibleVerse.Content.
      const blob=bytes(pick(c,['Content'],null));
      if(Number.isFinite(book)&&Number.isFinite(chapter)&&blob){
        const key=`${book}:${chapter}`;
        if(chapterIndex[key]===undefined){chapterIndex[key]=chapterRows.length;chapterRows.push({book,chapter,content:blob,firstVerseId:first,lastVerseId:last});}
      }
    }
    const verseLocation={};
    for(const [key,ch] of Object.entries(chapters)){
      const parts=key.split(':'),book=Number(parts[0]),chapter=Number(parts[1]);
      const first=Number(ch.firstVerseId),last=Number(ch.lastVerseId),firstNumbered=Number(ch.firstNumberedVerseId||first);
      for(let id=first;id<=last;id++){
        const ri=verseIndex[id],label=ri!==undefined?String(verseRows[ri].label||'').trim():'';
        const verse=Number(label)||Math.max(1,id-firstNumbered+1);
        verseLocation[id]={b:book,c:chapter,v:verse};
      }
    }
    const bookByDocId=new Map();
    for(const r of docRows){const type=Number(pick(r,['Type'],0)),book=Number(pick(r,['ChapterNumber'],0));if(type===2&&book>=1&&book<=66)bookByDocId.set(String(pick(r,['DocumentId','Id','RowId'],'')),book)}
    const crossRefs={},blockRefs={};
    for(const c of citationRows){
      const sourceId=Number(pick(c,['BibleVerseId'],0));
      const block=Number(pick(c,['BlockNumber'],0));
      const first=Number(pick(c,['FirstBibleVerseId'],0)),last=Number(pick(c,['LastBibleVerseId'],first));
      const a=verseLocation[first];if(!a)continue;
      const z=verseLocation[last]||a;
      const item={b:a.b,c:a.c,v:a.v,ec:z.c,e:z.v};
      const key=`${item.b}:${item.c}:${item.v}-${item.ec}:${item.e}`;
      if(block>0){
        // Only the 66 book documents own margin-reference blocks. Study notes,
        // introductions and appendices have their own BlockNumber counters;
        // folding them into the target book made every same-numbered block
        // merge unrelated citations into one ABCD marker.
        const bookNum=bookByDocId.get(String(pick(c,['DocumentId'],'')));
        if(bookNum){
          const blockKey=`${bookNum}:${block}`;
          if(!blockRefs[blockKey])blockRefs[blockKey]=[];
          if(!blockRefs[blockKey].some(x=>`${x.b}:${x.c}:${x.v}-${x.ec}:${x.e}`===key))blockRefs[blockKey].push(item);
        }
      }
      if(sourceId>0){
        const src=verseLocation[sourceId];if(!src)continue;
        const sourceKey=`${src.b}:${src.c}:${src.v}`;
        if(!crossRefs[sourceKey])crossRefs[sourceKey]=[];
        if(!crossRefs[sourceKey].some(x=>`${x.b}:${x.c}:${x.v}-${x.ec}:${x.e}`===key))crossRefs[sourceKey].push(item);
      }
    }
    const docBooks={};
    for(const r of docRows){
      const type=Number(pick(r,['Type'],0)),book=Number(pick(r,['ChapterNumber'],0));
      if(type===2&&book>=1&&book<=66){bookNames[book]=String(pick(r,['Title','Name'],''));const mid=String(pick(r,['MepsDocumentId'],'')||'');if(mid)docBooks[mid]=book}
    }
    bibleData={versionCodes:[...new Set([...hyperlinkById.values()].map(h=>{const m=h.match(/^jwpub:\/\/b\/([A-Za-z0-9]+)\//i);return m?m[1]:''}).filter(Boolean))],verseRows,verseIndex,refs,crossRefs,blockRefs,docBooks,chapters,chapterRows,chapterIndex,bookNames,keyHex:Array.from(ki.key).map(x=>x.toString(16).padStart(2,'0')).join(''),ivHex:Array.from(ki.iv).map(x=>x.toString(16).padStart(2,'0')).join('')};
  }
  citationRows.length=0;hyperlinkRows.length=0;bibleVerseRows.length=0;bibleLinkRows.length=0;
  const metadataByDoc=new Map();
  for(const mr of documentMetadataRows){const did=normId(pick(mr,['DocumentId'],''));if(!metadataByDoc.has(did))metadataByDoc.set(did,[]);metadataByDoc.get(did).push({key:String(pick(mr,['MetadataKey'],'')),value:String(pick(mr,['ValueRich','Value'],''))});}
  const docs=[];
  for(let i=0;i<docRows.length;i++){
    const r=docRows[i],blob=bytes(r.Content);
    if(!blob){importReport.emptyDocs=(importReport.emptyDocs||0)+1;continue}
    if(blob.length>JWPUB_MAX_DOC_BYTES){importReport.failedDocs++;importReport.warnings.push(`文档 ${i} 超过单篇上限`);continue}
    try{
      const decoded=await decryptContentAny(blob,ki);noteMode(decoded.mode);
      const html=decoded.html;
      docs.push({id:Number(pick(r,['DocumentId','Id','RowId'],i)),mepsId:Number(pick(r,['MepsDocumentId'],0)),title:String(pick(r,['Title','Name'],`章节 ${i+1}`)),titleRich:String(pick(r,['TitleRich'],'')),subtitle:String(pick(r,['Subtitle'],'')),subtitleRich:String(pick(r,['SubtitleRich'],'')),contextTitle:String(pick(r,['ContextTitle'],'')),contextTitleRich:String(pick(r,['ContextTitleRich'],'')),featureTitleRich:String(pick(r,['FeatureTitleRich'],'')),documentClass:Number(pick(r,['Class'],0)),documentType:Number(pick(r,['Type'],0)),sectionNumber:Number(pick(r,['SectionNumber'],0)),chapterNumber:Number(pick(r,['ChapterNumber'],0)),tocTitle:String(pick(r,['TocTitle'],'')),firstPageNumber:Number(pick(r,['FirstPageNumber'],0)),lastPageNumber:Number(pick(r,['LastPageNumber'],0)),metadata:metadataByDoc.get(normId(pick(r,['DocumentId','Id','RowId'],i)))||[],rawHtml:html});
    }catch(e){importReport.failedDocs++;if(importReport.warnings.length<8)importReport.warnings.push(`文档 ${i} 解码失败：${e&&e.message||e}`)}
    if(i%5===0)onProgress(`正在解密正文… ${i+1}/${docRows.length}`);
  }
  if(!docs.length&&!bibleData)throw new Error(`没有成功解密任何正文，也没有识别到圣经经文表。\n已读取 Document ${docRows.length} 条，失败 ${importReport.failedDocs} 条。\n请确认此 PUB 版本是否受支持，并把这条信息反馈。`);
  const attemptedDocs=docRows.length-Number(importReport.emptyDocs||0);
  if(attemptedDocs>0&&importReport.failedDocs/attemptedDocs>JWPUB_MAX_FAIL_RATIO)throw new Error(`正文解码失败过多（${importReport.failedDocs}/${attemptedDocs}），已停止导入以免保存残缺出版物。\n${importReport.warnings.join('\n')}`);
  if(!docs.length&&bibleData)docs.push({id:-1,mepsId:0,title:'圣经经文',html:'<h1>圣经经文</h1><p>此文件包含圣经经文数据。请从其他出版物中的经文链接进入具体章节。</p>'});
  documentMetadataRows.length=0;
  const datedByDoc=new Map(datedTexts.map(dt=>[String(dt.documentId),dt]));
  const articleDocs=docs.filter(d=>Number(d.documentClass)===40&&!d.datedText).sort((a,b)=>Number(a.id)-Number(b.id));
  const datedRows=datedTexts.filter(dt=>Number(dt.firstDateOffset)>0).sort((a,b)=>Number(a.firstDateOffset)-Number(b.firstDateOffset));
  const watchtowerStudyArticles=articleDocs.map(d=>{const dt=datedByDoc.get(String(d.id));return {docId:d.id,mepsId:Number(d.mepsId||0),title:d.title||'',contextTitle:d.contextTitle||'',contextTitleRich:d.contextTitleRich||'',firstDateOffset:dt?Number(dt.firstDateOffset):null,lastDateOffset:dt?Number(dt.lastDateOffset??dt.firstDateOffset):null}});
  // Study-edition JWPUBs usually point every DatedText row at the table of
  // contents instead of the individual STUDY ARTICLE documents. In that case
  // pair the dated rows with the articles in reading order.
  if(!watchtowerStudyArticles.some(a=>Number(a.firstDateOffset)>0)&&datedRows.length&&articleDocs.length){
    const directlyMatched=datedRows.some(dt=>articleDocs.some(d=>String(d.id)===String(dt.documentId)));
    if(!directlyMatched){const n=Math.min(datedRows.length,articleDocs.length);for(let i=0;i<n;i++){watchtowerStudyArticles[i].firstDateOffset=Number(datedRows[i].firstDateOffset);watchtowerStudyArticles[i].lastDateOffset=Number(datedRows[i].lastDateOffset??datedRows[i].firstDateOffset)}}
  }
  if(watchtowerStudyArticles.length)pub.watchtowerStudyArticles=watchtowerStudyArticles;
  const meetingWeeks=docs.filter(d=>Number(d.documentClass)===106&&!d.datedText).map(d=>{const dt=datedByDoc.get(String(d.id));return dt?{docId:d.id,title:d.title||'',firstDateOffset:Number(dt.firstDateOffset),lastDateOffset:Number(dt.lastDateOffset)}:null}).filter(Boolean);
  if(meetingWeeks.length)pub.meetingWeeks=meetingWeeks;
  onProgress('正在整理目录和图片…');
  // Prefer the publication's own "jwpub" view. Study Bibles also contain an
  // "alldocs" view; merging both duplicates every book and branch.
  const publicationViews=rows(db,'PublicationView');
  const jwView=publicationViews.find(v=>String(pick(v,['Symbol'],'')).toLowerCase()==='jwpub');
  const chosenViewId=jwView?Number(pick(jwView,['PublicationViewId'],0)):0;
  const allViewRows=rows(db,'PublicationViewItem');
  const rawViewRows=chosenViewId?allViewRows.filter(r=>Number(pick(r,['PublicationViewId'],0))===chosenViewId):allViewRows;
  // The real schema links a TOC item to its document in
  // PublicationViewItemDocument (and mirrors it in DefaultDocumentId);
  // PublicationViewItem has no DocumentId column. Reading the wrong column made
  // every TOC node a group and flattened the table of contents.
  const viewDocRows=rows(db,'PublicationViewItemDocument');
  const viewDocMap=new Map();
  for(const r of viewDocRows){
    const vid=normId(pick(r,['PublicationViewItemId','Id'],''));
    if(!vid||viewDocMap.has(vid))continue;
    const did=Number(pick(r,['DocumentId'],-1));
    if(Number.isFinite(did)&&did>=0)viewDocMap.set(vid,did);
  }
  databaseInfo.publicationViews=publicationViews.map(v=>({id:Number(pick(v,['PublicationViewId'],0)),name:String(pick(v,['Name'],'')),symbol:String(pick(v,['Symbol'],''))}));
  databaseInfo.chosenView=chosenViewId||null;
  databaseInfo.viewItems=rawViewRows.length;
  databaseInfo.viewItemDocuments=viewDocRows.length;
  const viewRows=rawViewRows.map((r,i)=>({...r,__rowOrder:i,__sortOrder:sortOrder(r,i)}))
    .sort((a,b)=>a.__sortOrder-b.__sortOrder||a.__rowOrder-b.__rowOrder);
  const docMap=new Map(docs.map(d=>[normId(d.id),d]));
  const nodes=viewRows.map((r,i)=>{
    const id=normId(pick(r,['PublicationViewItemId','Id','ViewItemId'],i));
    const mapped=viewDocMap.get(id);
    let docId=mapped!==undefined?mapped:Number(pick(r,['DefaultDocumentId'],-1));
    if(!Number.isFinite(docId)||docId<0)docId=Number(pick(r,['DocumentId','DocumentIdRef'],-1));
    return {
      id,
      parent:normId(pick(r,['ParentPublicationViewItemId','ParentId'],-1)),
      docId:Number.isFinite(docId)?docId:-1,
      title:String(pick(r,['TocTitle','Title','Name','DisplayTitle'],'')),
      titleRich:String(pick(r,['TocTitleRich','TitleRich'],'')),
      order:Number(r.__sortOrder??i),
      children:[]
    };
  });
  const nodeMap=new Map(nodes.map(n=>[n.id,n])), roots=[];
  nodes.forEach(n=>{const parent=nodeMap.get(n.parent);if(parent&&parent!==n)parent.children.push(n);else roots.push(n)});
  const visited=new Set(),toc=[];
  function walk(n,depth=0){
    if(visited.has(n.id))return;
    visited.add(n.id);
    const d=n.docId>=0?docMap.get(normId(n.docId)):null;
    if(d)toc.push({nodeId:n.id,parentId:n.parent,docId:d.id,title:n.title||d.title,depth,group:false});
    else if(n.title)toc.push({nodeId:n.id,parentId:n.parent,docId:null,title:n.title,depth,group:true,tab:n.parent==='-1'});
    n.children.forEach(c=>walk(c,depth+1));
  }
  roots.forEach(n=>walk(n));
  const used=new Set(toc.filter(x=>x.docId!==null).map(x=>normId(x.docId)));
  // Bible publications use BibleChapter/BibleVerse for the actual text; the
  // remaining documents are study notes and appendices, not additional TOC
  // roots. Auto-adding them produces hundreds of flat entries.
  if(!bibleData)docs.forEach(d=>{if(!used.has(normId(d.id)))toc.push({nodeId:'auto_'+d.id,parentId:'-1',docId:d.id,title:d.title,depth:0,group:false,auto:true})});
  // Bible navigation: the publication's own view tree groups the 66 books and
  // the intro/search/appendix documents. Store that structure in metadata so the
  // Bible page does not have to guess from titles.
  let bibleStructure=null,bookChapters=null;
  if(bibleData&&Array.isArray(bibleData.verseRows)&&bibleData.verseRows.length){
    const cleanT=s=>String(s||'').replace(/[\u200b-\u200d\ufeff]/g,'').trim();
    const top=nodes.filter(n=>n.parent==='-1');
    const pickTop=pred=>top.filter(n=>pred(cleanT(n.title))).sort((a,b)=>Number(a.id)-Number(b.id))[0];
    const docMetaById=new Map(docRows.map(r=>[normId(pick(r,['DocumentId','Id'],'')),r]));
    const rowDocMap=new Map(docRows.map(r=>[normId(pick(r,['DocumentId','Id','RowId'],'')),r]));
    const docOf=n=>{const d=n&&n.docId>=0?rowDocMap.get(normId(n.docId)):null;return d||null};
    const allNodes=[];const collect=n=>{allNodes.push(n);(n.children||[]).forEach(collect)};top.forEach(collect);
    const introByBook=new Map(),outlineByBook=new Map();
    for(const d of docs){
      const bn=Number(d.chapterNumber||0);if(bn<1||bn>66)continue;
      if(Number(d.documentClass)===113&&!introByBook.has(bn))introByBook.set(bn,Number(d.id));
      if(Number(d.documentClass)===115&&!outlineByBook.has(bn))outlineByBook.set(bn,Number(d.id));
    }
    // In the jwpub view each book is represented by its text document directly
    // (Document.Type = 2). The document tree also contains more detailed
    // all-documents views, so do not assume the books are one level below top.
    const bookGroups=allNodes.filter(n=>{const d=docOf(n);return d&&Number(pick(d,['Type'],0))===2&&Number(pick(d,['ChapterNumber'],0))>=1&&Number(pick(d,['ChapterNumber'],0))<=66});
    const docsFromNode=n=>n?n.children.map(c=>({title:cleanT(c.title),docId:Number(c.docId)})).filter(x=>Number.isFinite(x.docId)&&x.docId>=0):[];
    const books=bookGroups.map(n=>{
      const d=docOf(n),num=Number(d&&pick(d,['ChapterNumber'],0)||0);
      return {num,name:cleanT(n.title),introDocId:introByBook.get(num)||null,outlineDocId:outlineByBook.get(num)||null,textDocId:Number(n.docId)>=0?Number(n.docId):null};
    }).sort((a,b)=>a.num-b.num);
    bookChapters={};
    for(const c of bibleChapterRows){const b=Number(pick(c,['BookNumber'],0)),ch=Number(pick(c,['ChapterNumber'],0));if(b>=1&&b<=66&&ch>0)bookChapters[b]=Math.max(bookChapters[b]||0,ch)}
    const introNode=pickTop(t=>/^(简介|introduction|introducción|introdução|紹介|소개)/i.test(t));
    const searchNode=pickTop(t=>/^(检索|index|índice|索引|색인)/i.test(t));
    const appendixNode=l=>pickTop(t=>new RegExp('^(附录|appendix|apéndice|付録|부록)\\s*'+l,'i').test(t));
    bibleStructure={books,intro:docsFromNode(introNode),search:docsFromNode(searchNode),appendixA:docsFromNode(appendixNode('A')),appendixB:docsFromNode(appendixNode('B')),appendixC:docsFromNode(appendixNode('C')),tabs:top.map(n=>({title:cleanT(n.title),docId:Number.isFinite(Number(n.docId))&&Number(n.docId)>=0?Number(n.docId):null})).filter(x=>x.title)};
  }
  pub.bibleStructure=bibleStructure;pub.bookChapters=bookChapters;

  // Daily-text publications can store each date in DatedText rather than
  // Document.Content. Meeting workbooks and Watchtower issues also have
  // DatedText rows, but those are week/article ranges and must not become
  // daily-text documents.
  if(isDailyTextPublication(pub)){
    const datedDocs=[],datedMonths=new Map();
    for(const dt of datedTexts){
      const dateKey=dailyDateKey(dt.firstDateOffset,pub.year);
      const title=dailyDateLabel(dateKey)||`每日经文 ${dt.firstDateOffset+1}`;
      const d={id:`dated-${dt.id}`,mepsId:0,title,html:dt.html,datedText:true,dateOffset:dt.firstDateOffset,lastDateOffset:dt.lastDateOffset,datedTextId:dt.id,dateKey,documentId:dt.documentId};
      datedDocs.push(d);docs.push(d);
      if(dateKey){
        const month=Math.floor(dateKey/100);
        if(!datedMonths.has(month))datedMonths.set(month,{first:d,documentId:dt.documentId});
      }
    }
    // Daily-text JWPUBs have one document per month and one DatedText row per
    // day. Adding every day to the TOC produced hundreds of identical entries;
    // expose months only, pointing at the month document when it exists.
    const tocDocIds=new Set(toc.filter(x=>x.docId!==null&&x.docId!==undefined).map(x=>normId(x.docId)));
    for(const [month,info] of [...datedMonths.entries()].sort((a,b)=>a[0]-b[0])){
      const monthDoc=(info.documentId&&docs.find(d=>!d.datedText&&String(d.id)===String(info.documentId)))||null;
      if(monthDoc&&tocDocIds.has(normId(monthDoc.id)))continue;
      const docId=monthDoc?monthDoc.id:info.first.id;
      toc.push({nodeId:`dated-month-${month}`,parentId:'-1',docId,title:dailyMonthLabel(info.first.dateKey),depth:0,group:false,datedMonth:true});
      tocDocIds.add(normId(docId));
    }
  }
  db.close();
  const assets=[],sourceFiles=[];
  for(const [name,entry] of Object.entries(inner.files)){
    if(entry.dir||name===dbName||entry===dbEntry)continue;
    const lower=name.toLowerCase();
    const isMedia=/\.(jpg|jpeg|png|gif|webp|svg|pdf|woff2?|ttf|otf)$/i.test(lower);
    if(!captureSource&&!isMedia)continue;
    try{
      const blob=await entry.async('blob');
      if(isMedia)assets.push({name,blob});
      if(captureSource)sourceFiles.push({name,blob});
    }catch(e){}
  }
  const outerFiles=[];
  if(captureSource){
    for(const [name,entry] of Object.entries(outer.files)){
      if(entry.dir||name==='manifest.json'||name==='contents')continue;
      try{outerFiles.push({name,blob:await entry.async('blob')})}catch(e){}
    }
  }
  importReport.totalDocs=totalDocRows;
  importReport.totalAssets=assets.length;
  importReport.ms=Date.now()-importReport.startedAt;
  if(importReport.failedDocs||importReport.failedExtracts||importReport.failedDated||importReport.failedCommentary){
    logDiag('warn','PUB 部分内容解码失败',{id:idFor(pub),failedDocs:importReport.failedDocs,failedExtracts:importReport.failedExtracts,failedDated:importReport.failedDated,failedCommentary:importReport.failedCommentary,modes:importReport.decodeModes,warnings:importReport.warnings});
  }else{
    logDiag('info','PUB 解析完成',{id:idFor(pub),docs:docs.length,assets:assets.length,ms:importReport.ms,modes:importReport.decodeModes});
  }
  pub.bibleData=bibleData;pub.databaseInfo=databaseInfo;pub.categoryPath=classifyPublication(pub);
  const result={...pub,id:idFor(pub),manifestName:manifest.name||file.name,originalFilename:file.name,commentaries,datedTexts,docs:docs.map(d=>{const {rawHtml,...meta}=d;return {...meta,html:rawHtml??d.html}}),toc,assets,bibleData,extracts,databaseInfo,importReport,importedAt:Date.now(),lastDocId:docs[0].id};
  if(captureSource){
    Object.defineProperty(result,'source',{value:{
      name:(file&&file.name)||'publication.jwpub',
      size:Number((file&&file.size)||(file&&file.length)||0)||sourceDbBytes.length,
      dbName,
      dbBytes:sourceDbBytes,
      manifestBytes,
      files:sourceFiles,
      outerFiles,
      importedAt:Date.now()
    },enumerable:false,configurable:true});
  }
  return result;
}
// Read only the bytes needed to rebuild a JWPUB. This is used by the
// "link original PUB" action so an existing parsed book can gain a shareable
// source without a full decrypt/re-import pass.
async function readJwpubSource(file){
  if(!window.JSZip)throw new Error('内置 PUB 压缩包组件未能加载，请重新打开完整的单文件 HTML。');
  const u8=await fileToBytes(file);
  const outer=await loadJwpubArchive(u8);
  const manifestFile=outer.file('manifest.json');
  if(!manifestFile)throw new Error('找不到 manifest.json；这可能不是标准 PUB 文件。');
  const manifestBytes=await manifestFile.async('uint8array');
  let manifest={};try{manifest=JSON.parse(new TextDecoder('utf-8').decode(manifestBytes))}catch(e){}
  let inner=outer;
  const contents=outer.file('contents');
  if(contents){const data=await contents.async('uint8array');if(data[0]===0x50&&data[1]===0x4b)inner=await JSZip.loadAsync(data);}
  const preferred=manifest.publication&&manifest.publication.fileName;
  let dbEntry=preferred?inner.file(preferred):null;
  if(!dbEntry){for(const [name,entry] of Object.entries(inner.files)){if(!entry.dir&&/\.(db|sqlite|sqlite3)$/i.test(name)){dbEntry=entry;break}}}
  if(!dbEntry)throw new Error('压缩包中没有找到数据库文件。');
  const dbName=dbEntry.name||preferred||'publication.db';
  const dbBytes=await dbEntry.async('uint8array');
  const files=[];
  for(const [name,entry] of Object.entries(inner.files)){
    if(entry.dir||name===dbName||entry===dbEntry)continue;
    try{files.push({name,blob:await entry.async('blob')})}catch(e){}
  }
  const outerFiles=[];
  for(const [name,entry] of Object.entries(outer.files)){
    if(entry.dir||name==='manifest.json'||name==='contents')continue;
    try{outerFiles.push({name,blob:await entry.async('blob')})}catch(e){}
  }
  return {name:(file&&file.name)||'publication.jwpub',size:u8.length,dbName,dbBytes,manifestBytes,files,outerFiles,importedAt:Date.now()};
}
const CATEGORY_META={
  bible:{icon:'book',desc:'圣经译本和参考圣经'},books:{icon:'books',desc:'完整书籍和学习书籍'},
  magazines:{icon:'magazine',desc:'守望台、警醒！及其他期刊'},
  'magazines.watchtower':{icon:'magazine',desc:'守望台'},'magazines.watchtower.study':{icon:'magazine',desc:'守望台研读版'},'magazines.watchtower.public':{icon:'magazine',desc:'守望台公众版'},'magazines.awake':{icon:'magazine',desc:'警醒！'},'magazines.other':{icon:'magazine',desc:'其他杂志'},
  brochures:{icon:'file',desc:'册子、小册子和单张'},'brochures.tracts':{icon:'file',desc:'单张和邀请函'},'brochures.booklets':{icon:'file',desc:'册子'},
  meetings:{icon:'calendar',desc:'聚会工作手册和节目'},reference:{icon:'search',desc:'研究指南、索引及工具书'},daily:{icon:'sun',desc:'每日经文出版物'},songs:{icon:'music',desc:'诗歌和歌曲资料'},
  other:{icon:'folder',desc:'其他出版物'},uncategorized:{icon:'help',desc:'尚未归类的出版物'}
};
