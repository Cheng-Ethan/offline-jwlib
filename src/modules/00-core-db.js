
(() => {
'use strict';
const $ = id => document.getElementById(id);
const APP_VERSION='1.0.0';
const DB_NAME='OfflineJwLibrary', DB_VERSION=5;
let idb, SQL, currentBook=null, currentIndex=0, fontSize=19, currentObjectUrls=[], bibleMode=false, bibleReturn=null;
let assetUrlCache=new Map(), pronunciationOn=false, historyWriteAt=0, readerReturnSection=null, readerNavSection=null, readerOriginSection=null, readerReturnTarget=null, readerSessionTab=null;
let bibleState={bookId:null,tab:'books',book:null};
let libraryTab='publications', categoryTrail=[], primarySection='home', tabEpoch=0;
let currentBibleId=null, bibleSection='正文', bibleSelectedBook=null;
let meetingBookId=null, meetingWeekDocId=null, meetingsExpanded=true;
let studyState={books:[],tags:[],notes:[],query:'',tagFilter:new Set()};
let noteEditorState=null;
let sectionViews={};
let sectionPageHistory={home:[],bible:[],library:[],meetings:[],study:[]};
const READER_CACHE_ID='readerPanelCache';
let readerCacheTimer=null,readerCacheLoaded=false,readerCacheTab='home';
function readerCachePayload(){return {id:READER_CACHE_ID,views:sectionViews,history:sectionPageHistory,tab:primarySection,updatedAt:Date.now()}}
function scheduleReaderCacheSave(){
  if(!readerCacheLoaded||readerCacheTimer)return;
  readerCacheTimer=setTimeout(()=>{readerCacheTimer=null;saveReaderCache().catch(()=>{})},500);
}
async function saveReaderCache(){if(!idb)return;try{await saveOne('system',readerCachePayload())}catch(e){}}
async function loadReaderCache(){
  try{
    const rec=await getOne('system',READER_CACHE_ID);
    if(rec){
      if(rec.views&&typeof rec.views==='object'&&!Array.isArray(rec.views)){
        for(const [tab,view] of Object.entries(rec.views))if(view&&view.bookId&&view.docId)sectionViews[tab]=view;
      }
      if(rec.history&&typeof rec.history==='object'){
        for(const key of Object.keys(sectionPageHistory)){
          const list=rec.history[key];
          if(Array.isArray(list))sectionPageHistory[key]=list.filter(x=>x&&x.bookId&&x.docId&&x.tab===key).slice(-30);
        }
      }
      if(rec.tab)readerCacheTab=String(rec.tab);
    }
  }catch(e){}
  readerCacheLoaded=true;
}
const bookLoadCache=new Map();
const BOOK_LOAD_CACHE_MAX=3;

const UI_LANGS={
 zh:{name:'中文',locale:'zh-CN',button:'中'},
 en:{name:'English',locale:'en-US',button:'EN'},
 ja:{name:'日本語',locale:'ja-JP',button:'日'},
 ko:{name:'한국어',locale:'ko-KR',button:'한'}
};
let uiLang='zh';try{if(UI_LANGS[localStorage.getItem('offlineLibraryUiLang')])uiLang=localStorage.getItem('offlineLibraryUiLang')}catch(e){}
// Content language is independent from the interface language. 'all' means
// show every imported language; otherwise it holds a MepsLanguageIndex.
let contentLangFilter='all';
try{const v=localStorage.getItem('offlineLibraryContentLang');if(v)contentLangFilter=v}catch(e){}
const CONTENT_LANG_NAMES={0:'English',1:'Español',2:'Deutsch',4:'Italiano',7:'日本語',279:'中文（简体）'};
function contentLangName(n){const k=Number(n);return CONTENT_LANG_NAMES[k]||(t('语言')+' '+k)}
function seriesKeyFor(b){
  if(!b)return '';
  const mp=(()=>{try{return b.manifestRaw&&b.manifestRaw.publication||{}}catch(e){return {}}})();
  const symbol=String(b.uniqueEnglishSymbol||b.englishSymbol||b.uniqueSymbol||b.undatedSymbol||mp.uniqueEnglishSymbol||mp.englishSymbol||mp.uniqueSymbol||mp.undatedSymbol||b.symbol||'').trim();
  const issue=Number(b.issue||0)||0;
  return symbol+'#'+issue;
}
function isDailyTextPublication(b){
  if(!b)return false;
  const mp=(()=>{try{return b.manifestRaw&&b.manifestRaw.publication||{}}catch(e){return {}}})();
  const path=Array.isArray(b.categoryPath)?b.categoryPath:[];
  const code=String(b.publicationCategorySymbol||(Array.isArray(b.categoryCodes)?b.categoryCodes[0]:'')||mp.publicationCategorySymbol||'').toLowerCase();
  const sym=String(b.uniqueEnglishSymbol||b.englishSymbol||b.uniqueSymbol||b.symbol||mp.uniqueEnglishSymbol||mp.englishSymbol||mp.uniqueSymbol||mp.symbol||'').toLowerCase();
  const type=String(b.publicationType||mp.publicationType||'').toLowerCase();
  const title=String(b.displayTitle||b.title||mp.displayTitle||mp.title||'').toLowerCase();
  return path[0]==='daily'||String(b.categoryId||'')==='daily'||code==='es'||/^es\d/.test(sym)||/daily.?text|examining the scriptures|每日经文|天天查考圣经/.test(type+' '+title);
}
function bookInContentFilter(b){return contentLangFilter==='all'||String(b&&b.lang)===String(contentLangFilter)}
const I18N={
en:{
 '我的私人图书馆':'My Personal Library','首页':'Home','圣经':'Bible','多媒体图书馆':'Media Library','聚会':'Meetings','个人研读':'Personal Study',
 '分类':'Categories','已下载':'Downloaded','收藏':'Favorites','搜索出版物标题…':'Search publications…','导入 PUB':'Import PUB','导出备份':'Export backup','恢复备份':'Restore backup',
 '按类别浏览':'Browse by category','全部类别':'All categories','搜索结果':'Search results','我的收藏':'My Favorites','全部已下载出版物':'All downloaded publications',
 '按标题':'Title','最常使用':'Most used','最少使用':'Least used','文件最大':'Largest','本':'items','项':'items',
 '这里还没有出版物。':'No publications yet.','没有找到匹配的出版物。':'No matching publications.',
 '今日经文':'Today’s Text','最新导入':'Recent Imports','导入与管理':'Import & Manage','个人研读与设置':'Personal Study & Settings','阅读全文':'Read full text',
 '还没有收藏。在出版物卡片上点击“收藏”即可加入这里。':'No favorites yet. Tap the star on a publication to add it here.',
 '还没有资料':'No publications yet','导入 PUB 后会显示在这里。':'Import a PUB to see it here.',
 '今天没有可用的每日经文':'No daily text for today','请导入包含今天日期的每日经文 PUB（例如当年度的“天天查考圣经”）。':'Import a daily-text PUB that includes today’s date.',
 '选择经卷、章节或栏目':'Choose a book, chapter or section','当前译本':'Current version','首选':'Preferred','上移':'Move up','下移':'Move down',
 '简介':'Introduction','正文':'Text','检索':'Index','附录A':'Appendix A','附录B':'Appendix B','附录C':'Appendix C',
 '希伯来语经卷':'Hebrew Scriptures','希腊语经卷':'Greek Scriptures','全部经卷':'All books','本书简介':'Book introduction','内容大纲':'Outline','章':'chapters',
 '选择一个经卷，再选择章节。':'Choose a book, then a chapter.','这个译本没有提供经卷目录。':'This version has no book list.','这个译本没有提供章节正文。':'This version has no chapter text.','这个栏目没有可显示的内容。':'No content in this section.',
 '还没有导入圣经':'No Bible imported','支持《新世界译本》等 PUB。':'Supports the New World Translation and other PUB Bibles.',
 '本周聚会':'This Week’s Meeting','上一周':'Previous week','下一周':'Next week','今天':'Today','部分':'Section','环节':'Part','其他聚会资料':'Other meeting materials','共':'Total','份':'items',
 '还没有聚会资料':'No meeting publications','导入聚会工作手册 PUB 后，这里会显示本周要学习的内容。':'Import a Meeting Workbook PUB to see this week’s material.',
 '阅读历史':'Reading History','最近阅读':'Recent Reading','打开':'Open','打开 ›':'Open ›','还没有阅读记录。阅读文章后会自动记录':'No reading history yet. Reading an article records it automatically.','阅读任意文章后，这里会自动生成可点击的阅读记录。':'Reading any article creates a clickable history entry here.',
 '本机资料概况':'Library Overview','个人笔记':'Notes','书签':'Bookmarks','阅读记录':'History','导入与备份':'Import & Backup','阅读设置':'Reading Settings','我的书签':'My Bookmarks','我的笔记':'My Notes','系统诊断':'Diagnostics','管理全部笔记、书签与历史':'Manage all notes, bookmarks and history','导入、备份与设置':'Import, backup & settings','拼音':'Pinyin',
 '已导入':'Imported','未导入 · 勾选后导入':'Not imported · tick to import','全选未导入':'Select all new','导入选中':'Import selected','取消':'Cancel','关闭':'Close','知道了':'OK',
 '收藏该出版物':'Add to favorites','取消收藏':'Unfavorite','移动分类':'Move category','删除':'Delete','移动到分类':'Move to category','更多操作':'More actions','原始文件未知':'Original file unknown','文件：':'File:',
 '圣经译本和参考圣经':'Bible translations and reference Bibles','完整书籍和学习书籍':'Books and study books','守望台、警醒！及其他期刊':'Watchtower, Awake! and other magazines','册子、小册子和单张':'Brochures, booklets and tracts','聚会工作手册和节目':'Meeting workbooks and programs','研究指南、索引及工具书':'Research guides, indexes and reference works','每日经文出版物':'Daily-text publications','诗歌和歌曲资料':'Songs and music','暂未识别类型的出版物':'Unrecognized publications',
 '书籍':'Books','杂志':'Magazines','册子和单张':'Brochures & Tracts','聚会资料':'Meeting Materials','索引和参考资料':'Indexes & Reference','每日经文':'Daily Text','诗歌':'Songs','其他':'Other',
 '返回原文':'Back','目录':'Contents','更多信息':'More information','界面语言':'Interface language','使用说明':'Help',
 '已导入的文件显示为勾选；未导入的文件请点击勾选后导入。':'Imported files are checked; tick new files to import.','所选文件都已导入。':'All selected files are already imported.','请在列表中勾选需要导入的 PUB。':'Tick the PUB files to import.'
},
ja:{
 '我的私人图书馆':'私の個人図書館','首页':'ホーム','圣经':'聖書','多媒体图书馆':'マルチメディア図書館','聚会':'集会','个人研读':'個人研究',
 '分类':'カテゴリー','已下载':'ダウンロード済み','收藏':'お気に入り','搜索出版物标题…':'出版物を検索…','导入 PUB':'PUBをインポート','导出备份':'バックアップを書き出す','恢复备份':'バックアップを復元',
 '按类别浏览':'カテゴリーで見る','全部类别':'すべてのカテゴリー','搜索结果':'検索結果','我的收藏':'お気に入り','全部已下载出版物':'ダウンロード済みの出版物','按标题':'タイトル順','最常使用':'よく使う順','最少使用':'使用頻度が低い順','文件最大':'サイズ順','本':'冊','项':'件',
 '这里还没有出版物。':'まだ出版物がありません。','没有找到匹配的出版物。':'一致する出版物がありません。',
 '今日经文':'今日の聖句','最新导入':'最近のインポート','导入与管理':'インポートと管理','个人研读与设置':'個人研究と設定','阅读全文':'全文を読む',
 '还没有收藏。在出版物卡片上点击“收藏”即可加入这里。':'お気に入りはまだありません。出版物の☆をタップすると追加されます。',
 '还没有资料':'まだ資料がありません','导入 PUB 后会显示在这里。':'PUBをインポートするとここに表示されます。',
 '今天没有可用的每日经文':'今日の聖句がありません','请导入包含今天日期的每日经文 PUB（例如当年度的“天天查考圣经”）。':'今日の日付を含む日々の聖句PUBをインポートしてください。',
 '选择经卷、章节或栏目':'書、章、項目を選択','当前译本':'現在の訳','首选':'優先','上移':'上へ','下移':'下へ',
 '简介':'紹介','正文':'本文','检索':'索引','附录A':'付録A','附录B':'付録B','附录C':'付録C',
 '希伯来语经卷':'ヘブライ語聖書','希腊语经卷':'ギリシャ語聖書','全部经卷':'全書','本书简介':'この書の紹介','内容大纲':'内容の概略','章':'章',
 '选择一个经卷，再选择章节。':'書を選び、次に章を選んでください。','这个译本没有提供经卷目录。':'この訳には書の一覧がありません。','这个译本没有提供章节正文。':'この訳には章の本文がありません。','这个栏目没有可显示的内容。':'この項目に表示できる内容がありません。',
 '还没有导入圣经':'聖書がインポートされていません','支持《新世界译本》等 PUB。':'新世界訳などのPUBに対応しています。',
 '本周聚会':'今週の集会','上一周':'前の週','下一周':'次の週','今天':'今日','部分':'部分','环节':'項目','其他聚会资料':'他の集会資料','共':'全','份':'件',
 '还没有聚会资料':'集会資料がありません','导入聚会工作手册 PUB 后，这里会显示本周要学习的内容。':'集会ワークブックのPUBをインポートすると、今週の内容が表示されます。',
 '阅读历史':'閲覧履歴','最近阅读':'最近の閲覧','打开':'開く','打开 ›':'開く ›','还没有阅读记录。阅读文章后会自动记录':'閲覧履歴はまだありません。記事を読むと自動で記録されます。','阅读任意文章后，这里会自动生成可点击的阅读记录。':'記事を読むと、ここにクリックできる履歴が作成されます。',
 '本机资料概况':'ライブラリ概要','个人笔记':'メモ','书签':'ブックマーク','阅读记录':'閲覧履歴','导入与备份':'インポートとバックアップ','阅读设置':'読書設定','我的书签':'ブックマーク','我的笔记':'メモ','系统诊断':'診断','管理全部笔记、书签与历史':'メモ・ブックマーク・履歴を管理','导入、备份与设置':'インポート・バックアップ・設定','拼音':'ルビ',
 '已导入':'インポート済み','未导入 · 勾选后导入':'未インポート · チェックしてインポート','全选未导入':'未インポートを全選択','导入选中':'選択をインポート','取消':'キャンセル','关闭':'閉じる','知道了':'OK',
 '收藏该出版物':'お気に入りに追加','取消收藏':'お気に入りから削除','移动分类':'カテゴリー移動','删除':'削除','移动到分类':'カテゴリーへ移動','更多操作':'その他の操作','原始文件未知':'元のファイル名不明','文件：':'ファイル：',
 '圣经译本和参考圣经':'聖書翻訳と参考聖書','完整书籍和学习书籍':'書籍と学習書','守望台、警醒！及其他期刊':'ものみの塔、目ざめよ！などの雑誌','册子、小册子和单张':'パンフレット・小冊子・トラクト','聚会工作手册和节目':'集会ワークブックとプログラム','研究指南、索引及工具书':'研究ガイド・索引・参考資料','每日经文出版物':'日々の聖句の出版物','诗歌和歌曲资料':'歌と音楽','暂未识别类型的出版物':'未分類の出版物',
 '书籍':'書籍','杂志':'雑誌','册子和单张':'パンフレット','聚会资料':'集会資料','索引和参考资料':'索引・参考資料','每日经文':'日々の聖句','诗歌':'歌','其他':'その他',
 '返回原文':'戻る','目录':'目次','更多信息':'詳細情報','界面语言':'表示言語','使用说明':'ヘルプ',
 '已导入的文件显示为勾选；未导入的文件请点击勾选后导入。':'インポート済みはチェック済みです。未インポートのファイルにチェックを入れてください。','所选文件都已导入。':'選択したファイルはすべてインポート済みです。','请在列表中勾选需要导入的 PUB。':'インポートするPUBにチェックを入れてください。'
}
};
Object.assign(I18N.en,{
 '批量导入完成':'Import complete','成功':'Success','失败':'Failed','跳过':'Skipped','无':'None','刷新':'Refresh','复制诊断':'Copy diagnostics','下载诊断':'Download diagnostics','清理旧版冗余':'Clean old data','清理完成':'Cleanup complete','清理失败':'Cleanup failed','复制失败':'Copy failed','导出失败':'Export failed','已复制':'Copied','还没有笔记。阅读文章时可以添加笔记。':'No notes yet. You can add notes while reading.','打开阅读':'Open','查看目录':'Contents','提示':'Notice','更多':'More','马上打开':'Open now'
});
Object.assign(I18N.ja,{
 '批量导入完成':'インポート完了','成功':'成功','失败':'失敗','跳过':'スキップ','无':'なし','刷新':'更新','复制诊断':'診断をコピー','下载诊断':'診断をダウンロード','清理旧版冗余':'古いデータを整理','清理完成':'整理完了','清理失败':'整理に失敗','复制失败':'コピーに失敗','导出失败':'書き出しに失敗','已复制':'コピーしました','还没有笔记。阅读文章时可以添加笔记。':'メモはまだありません。記事を読みながら追加できます。','打开阅读':'開く','查看目录':'目次','提示':'お知らせ','更多':'その他','马上打开':'今すぐ開く'
});
Object.assign(I18N.en,{
 '出版物':'Publications','收藏的出版物会显示在这里':'Favorited publications appear here','还没有导入资料':'No imports yet','最近导入的资料会显示在这里':'Recently imported publications appear here','导入 PUB、备份、恢复和系统诊断。':'Import PUB, backup, restore and diagnostics.','数据保存在当前 Sitecase / 浏览器项目的本地数据库中。更换项目或更新来源前，请先导出备份。':'Data is stored in this Sitecase/browser project. Export a backup before changing project or source.','建议在升级前先导出完整备份；恢复备份会按记录 ID 合并数据。':'Export a full backup before upgrading; restoring merges records by ID.','调整阅读时的注音显示。设置只保存在当前浏览器项目中。':'Adjust pinyin display. The setting is stored only in this browser project.','点击记录可回到对应文章和上次阅读位置。':'Tap a record to return to the article and last position.','集中管理已经标记的文章或章节。':'Manage bookmarked articles or chapters.','笔记仅保存在本机；请通过完整备份在设备间迁移。':'Notes are stored on this device only; use a full backup to move them.','查看本机存储、迁移状态和最近的导入/备份事件。诊断信息不包含正文内容。':'View storage, migration status and recent import/backup events. Diagnostics contain no publication text.','导入圣经 PUB 后即可在这里按经卷阅读。':'Import a Bible PUB to read it by book.','最近导入的':'Recently imported','份资料':'publications','条记录':'records'
});
Object.assign(I18N.ja,{
 '出版物':'出版物','收藏的出版物会显示在这里':'お気に入りの出版物がここに表示されます','还没有导入资料':'まだインポートがありません','最近导入的资料会显示在这里':'最近インポートした出版物がここに表示されます','导入 PUB、备份、恢复和系统诊断。':'PUBのインポート、バックアップ、復元、診断。','数据保存在当前 Sitecase / 浏览器项目的本地数据库中。更换项目或更新来源前，请先导出备份。':'データはこのSitecase/ブラウザプロジェクトに保存されます。プロジェクトやソースを変更する前にバックアップを書き出してください。','建议在升级前先导出完整备份；恢复备份会按记录 ID 合并数据。':'アップグレード前に完全バックアップを書き出してください。復元はID単位で統合されます。','调整阅读时的注音显示。设置只保存在当前浏览器项目中。':'ルビ表示を調整します。設定はこのブラウザプロジェクトにのみ保存されます。','点击记录可回到对应文章和上次阅读位置。':'記録をタップすると、記事と前回の位置に戻ります。','集中管理已经标记的文章或章节。':'ブックマークした記事や章を管理します。','笔记仅保存在本机；请通过完整备份在设备间迁移。':'メモはこの端末にのみ保存されます。完全バックアップで移動してください。','查看本机存储、迁移状态和最近的导入/备份事件。诊断信息不包含正文内容。':'保存容量、移行状態、最近のインポート/バックアップを表示します。診断に本文は含まれません。','导入圣经 PUB 后即可在这里按经卷阅读。':'聖書PUBをインポートすると、書ごとに読めます。','最近导入的':'最近インポートした','份资料':'件','条记录':'件'
});
Object.assign(I18N.en,{'还没有阅读记录。':'No reading history yet.','还没有书签。':'No bookmarks yet.','还没有个人笔记。':'No personal notes yet.','返回原文':'Back'});
Object.assign(I18N.ja,{'还没有阅读记录。':'閲覧履歴はまだありません。','还没有书签。':'ブックマークはまだありません。','还没有个人笔记。':'メモはまだありません。','返回原文':'戻る'});
Object.assign(I18N.en,{'移除':'Remove','正在导入':'Importing'});
Object.assign(I18N.ja,{'移除':'削除','正在导入':'インポート中'});
Object.assign(I18N.en,{'使用说明内容':'This is a single-file offline library. Bottom navigation: Home, Bible, Media Library, Meetings, Personal Study. Tap once to return to the last position; double-tap to reset. To import, tap More in the top-right corner and choose PUB files from your device; new files are selected, already imported files are not. Use the language button in the header to switch the interface language; publications are filtered by language. Export backups regularly.'});
Object.assign(I18N.ja,{'使用说明内容':'これは単一HTMLのオフライン図書館です。下部ナビゲーション：ホーム、聖書、マルチメディア図書館、集会、個人研究。1回タップで前回の位置へ、2回タップで初期位置へ戻ります。PUBのインポートは右上の「その他」から行い、お使いのデバイスからファイルを選択します。未インポートのファイルは選択済み、インポート済みは未選択です。ヘッダーの言語ボタンで表示言語を切り替えると、出版物もその言語だけが表示されます。定期的にバックアップを書き出してください。'});
Object.assign(I18N.en,{'切换/排序圣经译本':'Switch / order Bible versions'});
Object.assign(I18N.ja,{'切换/排序圣经译本':'聖書訳の切替・並べ替え'});
Object.assign(I18N.en,{'搜索标题或正文':'Search titles or text','新标签':'New tag','编辑笔记':'Edit note','新建笔记':'New note','保存':'Save','写笔记…':'Write a note…','标题':'Title','标签':'Tags','无标题笔记':'Untitled note','（无正文）':'(No text)','没有找到匹配的笔记':'No matching notes','还没有笔记。阅读文章时可以添加笔记。':'No notes yet. You can add notes while reading.','打开原文':'Open original','删除标签':'Delete tag','标签操作':'Tag actions','笔记操作':'Note actions','本章笔记':'Chapter notes','本章还没有划线笔记。':'No highlights in this chapter yet.','备份笔记':'Back up notes','恢复笔记':'Restore notes','备份整个图书馆':'Back up library','恢复整个图书馆':'Restore library','系统诊断':'Diagnostics','写批注…':'Write a comment…'});
Object.assign(I18N.ja,{'搜索标题或正文':'タイトルや本文を検索','新标签':'新しいタグ','编辑笔记':'メモを編集','新建笔记':'新しいメモ','保存':'保存','写笔记…':'メモを書く…','标题':'タイトル','标签':'タグ','无标题笔记':'無題のメモ','（无正文）':'(本文なし)','没有找到匹配的笔记':'一致するメモがありません','还没有笔记。阅读文章时可以添加笔记。':'メモはまだありません。記事を読みながら追加できます。','打开原文':'原文を開く','删除标签':'タグを削除','标签操作':'タグ操作','笔记操作':'メモ操作','本章笔记':'この章のメモ','本章还没有划线笔记。':'この章にはまだハイライトがありません。','备份笔记':'メモをバックアップ','恢复笔记':'メモを復元','备份整个图书馆':'図書館全体をバックアップ','恢复整个图书馆':'図書館全体を復元','系统诊断':'診断','写批注…':'コメントを書く…'});
Object.assign(I18N.en,{'笔记':'Note'});
Object.assign(I18N.ja,{'笔记':'メモ'});
Object.assign(I18N.en,{'收起':'Minimize','撤销':'Undo','前进':'Redo','相关经文':'Cross-references','经文信息':'Verse information','整节经文':'Whole verse','这一节没有可显示的脚注或相关经文。':'This verse has no footnotes or cross-references to display.','脚注':'Footnote','没有找到对应的脚注正文。':'Footnote text not found.','无法确定当前经卷。':'Cannot determine the current Bible book.','添加笔记':'Add note','复制本章':'Copy verse','复制经文':'Copy verse','没有找到相关经文。':'No cross-references found.','没有找到经文正文。':'Verse text not found.','正在读取…':'Loading…','仅显示前 20 条':'Showing the first 20 entries.','经文已复制。':'Verse copied.','这份圣经是在旧版本导入的，没有串珠索引。请重新导入该圣经 PUB。':'This Bible was imported before cross-reference indexing. Re-import the Bible PUB.','搜索或新建标签':'Search or create a tag','搜索标题、正文或标签':'Search titles, text or tags'});
Object.assign(I18N.ja,{'收起':'最小化','撤销':'元に戻す','前进':'やり直す','相关经文':'参照聖句','经文信息':'聖句情報','整节经文':'節全体','这一节没有可显示的脚注或相关经文。':'この節には表示できる脚注や参照聖句がありません。','脚注':'脚注','没有找到对应的脚注正文。':'対応する脚注本文が見つかりません。','无法确定当前经卷。':'現在の聖書の書を特定できません。','添加笔记':'メモを追加','复制本章':'この節をコピー','复制经文':'この節をコピー','没有找到相关经文。':'参照聖句が見つかりません。','没有找到经文正文。':'聖句の本文が見つかりません。','正在读取…':'読み込み中…','仅显示前 20 条':'最初の20件を表示しています。','经文已复制。':'聖句をコピーしました。','这份圣经是在旧版本导入的，没有串珠索引。请重新导入该圣经 PUB。':'この聖書は古い版でインポートされたため、参照聖句索引がありません。聖書のPUBを再インポートしてください。','搜索或新建标签':'タグを検索または作成','搜索标题、正文或标签':'タイトル・本文・タグを検索'});
Object.assign(I18N.en,{'摩西五经':'Pentateuch','历史书':'Historical Books','诗歌智慧书':'Poetry & Wisdom','大先知书':'Major Prophets','小先知书':'Minor Prophets','福音书':'Gospels','使徒行传':'Acts','保罗书信':'Pauline Epistles','一般书信':'General Epistles','启示录':'Revelation','周末守望台研经班':'Weekend Watchtower Study'});
Object.assign(I18N.ja,{'摩西五经':'モーセ五書','历史书':'歴史書','诗歌智慧书':'詩歌・知恵文学','大先知书':'大預言者','小先知书':'小預言者','福音书':'福音書','使徒行传':'使徒言行録','保罗书信':'パウロ書簡','一般书信':'公同書簡','启示录':'黙示録','周末守望台研经班':'週末のものみの塔研究'});
Object.assign(I18N.en,{'设置与关于':'Settings & About','应用版本':'App version','数据库版本':'Database version','存储':'Storage','笔记':'Notes','划线':'Highlights','更新记录':'Update notes','离线应用不会联网检查更新；更新时请用新的单 HTML 文件替换，并先导出备份。':'This offline app does not check for updates online. To update, replace it with the new single HTML file and export a backup first.'});
Object.assign(I18N.ja,{'设置与关于':'設定と情報','应用版本':'アプリ版','数据库版本':'データベース版','存储':'保存容量','笔记':'メモ','划线':'ハイライト','更新记录':'更新履歴','离线应用不会联网检查更新；更新时请用新的单 HTML 文件替换，并先导出备份。':'このオフラインアプリは更新をオンライン確認しません。更新する場合は新しい単一HTMLに置き換え、先にバックアップを書き出してください。'});
Object.assign(I18N.en,{'导入《守望台》研读版后，这里会显示本周末研经文章的日期和链接。':'Import the Watchtower Study edition to see this weekend’s study article date and link here.'});
Object.assign(I18N.ja,{'导入《守望台》研读版后，这里会显示本周末研经文章的日期和链接。':'ものみの塔研究版をインポートすると、今週末の研究記事の日付とリンクがここに表示されます。'});
Object.assign(I18N.en,{'希伯来语及阿拉米语经卷':'Hebrew and Aramaic Scriptures','传道与生活聚会':'We Are Jehovah’s Witnesses — Life and Ministry Meeting','守望台研经班聚会':'Watchtower Study'});
Object.assign(I18N.ja,{'希伯来语及阿拉米语经卷':'ヘブライ語・アラム語聖書','传道与生活聚会':'伝道と生活の集会','守望台研经班聚会':'ものみの塔研究'});
Object.assign(I18N.en,{'语言':'Language','文档':'documents','添加语言':'Add language','导入语言包':'Import language pack','语言包导入失败':'Language pack import failed','语言包已导入':'Language pack imported','语言包格式不正确':'Invalid language pack format','内容语言':'Content language','全部语言':'All languages','勾选可覆盖重新导入':'tick to overwrite and re-import','未导入的文件默认勾选；':'New files are selected by default; ','默认不勾选；如需覆盖重新解析，请勾选对应文件。':'already imported files are unselected by default; tick one to overwrite and re-parse.','语言版本':'Language editions','切换语言版本':'Switch language edition','其他语言笔记':'Note from another language','没有可用的其他语言版本':'No other language edition is imported.','当前内容语言':'Current content language'});
Object.assign(I18N.ja,{'语言':'言語','文档':'文書','添加语言':'言語を追加','导入语言包':'言語パックをインポート','语言包导入失败':'言語パックのインポートに失敗しました','语言包已导入':'言語パックをインポートしました','语言包格式不正确':'言語パックの形式が正しくありません','内容语言':'コンテンツ言語','全部语言':'すべての言語','勾选可覆盖重新导入':'上書き再インポートするにはチェック','未导入的文件默认勾选；':'未インポートのファイルは既定で選択されています。','默认不勾选；如需覆盖重新解析，请勾选对应文件。':'インポート済みは既定で未選択です。上書き再解析するにはチェックしてください。','语言版本':'言語版','切换语言版本':'言語版を切り替え','其他语言笔记':'他の言語のメモ','没有可用的其他语言版本':'他の言語版はインポートされていません。','当前内容语言':'現在のコンテンツ言語'});
Object.assign(I18N.en,{'守望台':'Watchtower','守望台 · 研读版':'Watchtower Study Edition','守望台 · 公众版':'Watchtower Public Edition','警醒！':'Awake!','其他杂志':'Other magazines','单张和邀请函':'Tracts and invitations','册子':'Booklets','未分类':'Uncategorized','新建分类…':'New category…','新分类名称':'Category name','按此分类浏览':'Browse by category','守望台研读版':'Watchtower Study Edition','守望台公众版':'Watchtower Public Edition','其他出版物':'Other publications','尚未归类的出版物':'Not classified yet'});
Object.assign(I18N.en,{'分类管理':'Category management','还没有自定义分类。':'No custom categories yet.','重命名分类':'Rename category','删除分类':'Delete category','重新自动分类未手动归类的出版物':'Auto-classify publications without a manual category','已重新分类':'Reclassified'});
Object.assign(I18N.ja,{'分类管理':'カテゴリー管理','还没有自定义分类。':'カスタムカテゴリーはまだありません。','重命名分类':'カテゴリー名を変更','删除分类':'カテゴリーを削除','重新自动分类未手动归类的出版物':'手動分類されていない出版物を自動分類し直す','已重新分类':'再分類しました'});
Object.assign(I18N.ja,{'守望台':'ものみの塔','守望台 · 研读版':'ものみの塔 研究版','守望台 · 公众版':'ものみの塔 公開版','警醒！':'目ざめよ！','其他杂志':'その他の雑誌','单张和邀请函':'トラクトと招待状','册子':'小冊子','未分类':'未分類','新建分类…':'新しいカテゴリー…','新分类名称':'カテゴリー名','按此分类浏览':'このカテゴリーで見る','守望台研读版':'ものみの塔 研究版','守望台公众版':'ものみの塔 公開版','其他出版物':'その他の出版物','尚未归类的出版物':'まだ分類されていません'});
I18N.ko={
 '我的私人图书馆':'나의 개인 도서관','首页':'홈','圣经':'성경','多媒体图书馆':'멀티미디어 도서관','聚会':'집회','个人研读':'개인 연구',
 '分类':'분류','已下载':'다운로드됨','收藏':'즐겨찾기','搜索出版物标题…':'출판물 제목 검색…','导入 PUB':'PUB 가져오기','导出备份':'백업 내보내기','恢复备份':'백업 복원',
 '按类别浏览':'분류별로 보기','全部类别':'모든 분류','搜索结果':'검색 결과','我的收藏':'내 즐겨찾기','全部已下载出版物':'다운로드한 모든 출판물',
 '按标题':'제목순','最常使用':'많이 사용','最少使用':'적게 사용','文件最大':'파일 크기순','本':'권','项':'항목',
 '这里还没有出版物。':'아직 출판물이 없습니다.','没有找到匹配的出版物。':'일치하는 출판물이 없습니다.',
 '今日经文':'오늘의 성구','最新导入':'최근 가져온 항목','导入与管理':'가져오기 및 관리','个人研读与设置':'개인 연구 및 설정','阅读全文':'전체 읽기',
 '还没有收藏。在出版物卡片上点击“收藏”即可加入这里。':'즐겨찾기가 없습니다. 출판물 카드에서 즐겨찾기를 누르면 여기에 추가됩니다.',
 '还没有资料':'아직 자료가 없습니다','导入 PUB 后会显示在这里。':'PUB를 가져오면 여기에 표시됩니다.',
 '今天没有可用的每日经文':'오늘 사용할 수 있는 일용할 성구가 없습니다','请导入包含今天日期的每日经文 PUB（例如当年度的“天天查考圣经”）。':'오늘 날짜가 포함된 일용할 성구 PUB를 가져오십시오.',
 '选择经卷、章节或栏目':'책, 장 또는 항목 선택','当前译本':'현재 번역판','首选':'우선','上移':'위로','下移':'아래로',
 '简介':'소개','正文':'본문','检索':'색인','附录A':'부록 A','附录B':'부록 B','附录C':'부록 C',
 '希伯来语经卷':'히브리어 성경','希腊语经卷':'그리스어 성경','全部经卷':'모든 책','本书简介':'이 책의 소개','内容大纲':'내용 개요','章':'장',
 '选择一个经卷，再选择章节。':'책을 선택한 다음 장을 선택하십시오.','这个译本没有提供经卷目录。':'이 번역판에는 책 목록이 없습니다.','这个译本没有提供章节正文。':'이 번역판에는 장 본문이 없습니다.','这个栏目没有可显示的内容。':'이 항목에는 표시할 내용이 없습니다.',
 '还没有导入圣经':'성경을 가져오지 않았습니다','支持《新世界译本》等 PUB。':'신세계역 등 PUB를 지원합니다.',
 '本周聚会':'이번 주 집회','上一周':'이전 주','下一周':'다음 주','今天':'오늘','部分':'부분','环节':'항목','其他聚会资料':'다른 집회 자료','共':'전체','份':'항목',
 '还没有聚会资料':'집회 자료가 없습니다','导入聚会工作手册 PUB 后，这里会显示本周要学习的内容。':'집회 활동 책 PUB를 가져오면 이번 주 학습 내용이 여기에 표시됩니다.',
 '阅读历史':'읽기 기록','最近阅读':'최근 읽은 항목','打开':'열기','打开 ›':'열기 ›','还没有阅读记录。阅读文章后会自动记录':'읽기 기록이 없습니다. 기사를 읽으면 자동으로 기록됩니다.','阅读任意文章后，这里会自动生成可点击的阅读记录。':'기사를 읽으면 여기에 클릭 가능한 읽기 기록이 생성됩니다.',
 '本机资料概况':'라이브러리 개요','个人笔记':'메모','书签':'북마크','阅读记录':'읽기 기록','导入与备份':'가져오기 및 백업','阅读设置':'읽기 설정','我的书签':'내 북마크','我的笔记':'내 메모','系统诊断':'진단','管理全部笔记、书签与历史':'모든 메모, 북마크, 기록 관리','导入、备份与设置':'가져오기, 백업 및 설정','拼音':'병음',
 '已导入':'가져옴','未导入 · 勾选后导入':'가져오지 않음 · 선택 후 가져오기','全选未导入':'새 항목 모두 선택','导入选中':'선택 항목 가져오기','取消':'취소','关闭':'닫기','知道了':'확인',
 '收藏该出版物':'즐겨찾기에 추가','取消收藏':'즐겨찾기 해제','移动分类':'분류 이동','删除':'삭제','移动到分类':'분류로 이동','更多操作':'더 많은 작업','原始文件未知':'원본 파일 알 수 없음','文件：':'파일:',
 '圣经译本和参考圣经':'성경 번역판 및 참고 성경','完整书籍和学习书籍':'책 및 학습서','守望台、警醒！及其他期刊':'파수대, 깨어라! 및 기타 정기간행물','册子、小册子和单张':'브로슈어, 소책자 및 전도지','聚会工作手册和节目':'집회 활동 책 및 프로그램','研究指南、索引及工具书':'연구 안내서, 색인 및 참고 자료','每日经文出版物':'일용할 성구 출판물','诗歌和歌曲资料':'노래 및 음악 자료','暂未识别类型的出版物':'분류되지 않은 출판물',
 '书籍':'책','杂志':'잡지','册子和单张':'브로슈어 및 전도지','聚会资料':'집회 자료','索引和参考资料':'색인 및 참고 자료','每日经文':'일용할 성구','诗歌':'노래','其他':'기타',
 '返回原文':'원문으로 돌아가기','目录':'목차','更多信息':'더 많은 정보','界面语言':'인터페이스 언어','使用说明':'도움말',
 '已导入的文件显示为勾选；未导入的文件请点击勾选后导入。':'가져온 파일은 선택되어 있습니다. 새 파일을 선택하여 가져오십시오.','所选文件都已导入。':'선택한 파일은 모두 가져왔습니다.','请在列表中勾选需要导入的 PUB。':'가져올 PUB를 선택하십시오.',
 '批量导入完成':'가져오기 완료','成功':'성공','失败':'실패','跳过':'건너뜀','无':'없음','刷新':'새로 고침','复制诊断':'진단 복사','下载诊断':'진단 다운로드','清理旧版冗余':'이전 데이터 정리','清理完成':'정리 완료','清理失败':'정리 실패','复制失败':'복사 실패','导出失败':'내보내기 실패','已复制':'복사됨','还没有笔记。阅读文章时可以添加笔记。':'메모가 없습니다. 기사를 읽으며 메모를 추가할 수 있습니다.','打开阅读':'열기','查看目录':'목차 보기','提示':'알림','更多':'더보기','马上打开':'지금 열기',
 '出版物':'출판물','收藏的出版物会显示在这里':'즐겨찾는 출판물이 여기에 표시됩니다','还没有导入资料':'아직 가져온 자료가 없습니다','最近导入的资料会显示在这里':'최근 가져온 출판물이 여기에 표시됩니다','导入 PUB、备份、恢复和系统诊断。':'PUB 가져오기, 백업, 복원 및 진단.','数据保存在当前 Sitecase / 浏览器项目的本地数据库中。更换项目或更新来源前，请先导出备份。':'데이터는 현재 Sitecase/브라우저 프로젝트의 로컬 데이터베이스에 저장됩니다. 프로젝트나 소스를 변경하기 전에 백업을 내보내십시오.','建议在升级前先导出完整备份；恢复备份会按记录 ID 合并数据。':'업그레이드 전에 전체 백업을 내보내는 것이 좋습니다. 복원은 기록 ID별로 병합됩니다.','调整阅读时的注音显示。设置只保存在当前浏览器项目中。':'읽을 때 병음 표시를 조정합니다. 설정은 현재 브라우저 프로젝트에만 저장됩니다.','点击记录可回到对应文章和上次阅读位置。':'기록을 누르면 해당 기사와 마지막 읽은 위치로 돌아갑니다.','集中管理已经标记的文章或章节。':'북마크한 기사나 장을 관리합니다.','笔记仅保存在本机；请通过完整备份在设备间迁移。':'메모는 이 기기에만 저장됩니다. 전체 백업으로 다른 기기로 옮기십시오.','查看本机存储、迁移状态和最近的导入/备份事件。诊断信息不包含正文内容。':'저장 공간, 마이그레이션 상태, 최근 가져오기/백업 이벤트를 봅니다. 진단 정보에는 본문이 포함되지 않습니다.','导入圣经 PUB 后即可在这里按经卷阅读。':'성경 PUB를 가져오면 여기에서 책별로 읽을 수 있습니다.','最近导入的':'최근 가져온','份资料':'개 출판물','条记录':'개 기록',
 '还没有阅读记录。':'읽기 기록이 없습니다.','还没有书签。':'북마크가 없습니다.','还没有个人笔记。':'개인 메모가 없습니다.','返回原文':'원문으로 돌아가기',
 '移除':'제거','正在导入':'가져오는 중',
 '使用说明内容':'단일 HTML 오프라인 도서관입니다. 하단 탐색: 홈, 성경, 멀티미디어 도서관, 집회, 개인 연구. 한 번 누르면 마지막 위치로, 두 번 누르면 기본 위치로 돌아갑니다. PUB 가져오기는 오른쪽 위 「더보기」에서 하며, 기기에서 파일을 선택합니다. 가져오지 않은 파일은 선택되고 가져온 파일은 선택되지 않습니다. 헤더의 언어 버튼으로 인터페이스 언어를 바꿀 수 있습니다. 정기적으로 백업을 내보내십시오.',
 '切换/排序圣经译本':'성경 번역판 전환/정렬',
 '搜索标题或正文':'제목 또는 본문 검색','新标签':'새 태그','编辑笔记':'메모 편집','新建笔记':'새 메모','保存':'저장','写笔记…':'메모 작성…','标题':'제목','标签':'태그','无标题笔记':'제목 없는 메모','（无正文）':'(본문 없음)','没有找到匹配的笔记':'일치하는 메모가 없습니다','打开原文':'원문 열기','删除标签':'태그 삭제','标签操作':'태그 작업','笔记操作':'메모 작업','本章笔记':'이 장의 메모','本章还没有划线笔记。':'이 장에는 아직 하이라이트 메모가 없습니다.','备份笔记':'메모 백업','恢复笔记':'메모 복원','备份整个图书馆':'도서관 전체 백업','恢复整个图书馆':'도서관 전체 복원','写批注…':'주석 작성…',
 '笔记':'메모','收起':'최소화','撤销':'실행 취소','前进':'다시 실행','相关经文':'관련 성구','经文信息':'구절 정보','整节经文':'전체 구절','这一节没有可显示的脚注或相关经文。':'이 구절에는 표시할 각주나 관련 성구가 없습니다.','脚注':'각주','没有找到对应的脚注正文。':'해당 각주 본문을 찾지 못했습니다.','无法确定当前经卷。':'현재 성경 책을 확인할 수 없습니다.','添加笔记':'메모 추가','复制本章':'이 구절 복사','复制经文':'이 구절 복사','没有找到相关经文。':'관련 성구를 찾지 못했습니다.','没有找到经文正文。':'성구 본문을 찾지 못했습니다.','正在读取…':'읽는 중…','仅显示前 20 条':'처음 20개만 표시합니다.','经文已复制。':'구절을 복사했습니다.','这份圣经是在旧版本导入的，没有串珠索引。请重新导入该圣经 PUB。':'이 성경은 이전 버전에서 가져와 관련 성구 색인이 없습니다. 성경 PUB를 다시 가져오십시오.','搜索或新建标签':'태그 검색 또는 만들기','搜索标题、正文或标签':'제목, 본문 또는 태그 검색',
 '摩西五经':'모세오경','历史书':'역사서','诗歌智慧书':'시가서','大先知书':'대예언서','小先知书':'소예언서','福音书':'복음서','使徒行传':'사도행전','保罗书信':'바울 서신','一般书信':'일반 서신','启示录':'계시록','周末守望台研经班':'주말 파수대 연구',
 '设置与关于':'설정 및 정보','应用版本':'앱 버전','数据库版本':'데이터베이스 버전','存储':'저장 공간','划线':'하이라이트','更新记录':'업데이트 기록','离线应用不会联网检查更新；更新时请用新的单 HTML 文件替换，并先导出备份。':'이 오프라인 앱은 온라인으로 업데이트를 확인하지 않습니다. 업데이트하려면 새 단일 HTML 파일로 교체하고 먼저 백업을 내보내십시오.',
 '导入《守望台》研读版后，这里会显示本周末研经文章的日期和链接。':'파수대 연구판을 가져오면 이번 주말 연구 기사의 날짜와 링크가 여기에 표시됩니다.',
 '希伯来语及阿拉米语经卷':'히브리어 및 아람어 성경','传道与生活聚会':'전도와 생활 집회','守望台研经班聚会':'파수대 연구 집회',
 '语言':'언어','文档':'문서','添加语言':'언어 추가','导入语言包':'언어 팩 가져오기','语言包导入失败':'언어 팩 가져오기 실패','语言包已导入':'언어 팩을 가져왔습니다','语言包格式不正确':'언어 팩 형식이 올바르지 않습니다','内容语言':'콘텐츠 언어','全部语言':'모든 언어','勾选可覆盖重新导入':'선택하면 덮어쓰기로 다시 가져옵니다','未导入的文件默认勾选；':'가져오지 않은 파일은 기본으로 선택됩니다. ','默认不勾选；如需覆盖重新解析，请勾选对应文件。':'가져온 파일은 기본으로 선택되지 않습니다. 덮어쓰기로 다시 분석하려면 해당 파일을 선택하십시오.','语言版本':'언어판','切换语言版本':'언어판 전환','其他语言笔记':'다른 언어 메모','没有可用的其他语言版本':'가져온 다른 언어판이 없습니다.','当前内容语言':'현재 콘텐츠 언어','守望台':'파수대','守望台 · 研读版':'파수대 연구판','守望台 · 公众版':'파수대 공개판','警醒！':'깨어라!','其他杂志':'기타 잡지','单张和邀请函':'전도지 및 초대장','册子':'소책자','未分类':'미분류','新建分类…':'새 분류…','新分类名称':'분류 이름','按此分类浏览':'이 분류로 보기','守望台研读版':'파수대 연구판','守望台公众版':'파수대 공개판','其他出版物':'기타 출판물','尚未归类的出版物':'아직 분류되지 않음'
};
Object.assign(I18N.ko,{'分类管理':'분류 관리','还没有自定义分类。':'사용자 분류가 없습니다.','重命名分类':'분류 이름 바꾸기','删除分类':'분류 삭제','重新自动分类未手动归类的出版物':'수동 분류가 없는 출판물 다시 자동 분류','已重新分类':'다시 분류함'});
Object.assign(I18N.en,{'清除颜色':'Clear highlight'});
Object.assign(I18N.ja,{'清除颜色':'ハイライトを消す'});
Object.assign(I18N.ko,{'清除颜色':'하이라이트 지우기'});
Object.assign(I18N.en,{'搜索':'Search','搜索经文或出版物…':'Search scriptures or this publication…','最近搜索':'Recent searches','搜索中…':'Searching…','正在准备经文索引…':'Preparing scripture index…','没有找到匹配结果':'No matches found','搜索范围':'Search in','没有搜索记录':'No recent searches'});
Object.assign(I18N.ja,{'搜索':'検索','搜索经文或出版物…':'聖句または出版物を検索…','最近搜索':'最近の検索','搜索中…':'検索中…','正在准备经文索引…':'聖句索引を準備中…','没有找到匹配结果':'一致する結果がありません','搜索范围':'検索範囲','没有搜索记录':'最近の検索はありません'});
Object.assign(I18N.ko,{'搜索':'검색','搜索经文或出版物…':'성구 또는 출판물 검색…','最近搜索':'최근 검색','搜索中…':'검색 중…','正在准备经文索引…':'성구 색인 준비 중…','没有找到匹配结果':'일치하는 결과가 없습니다','搜索范围':'검색 범위','没有搜索记录':'최근 검색이 없습니다'});
Object.assign(I18N.en,{'所有已导入出版物':'All imported publications','复制':'Copy'});
Object.assign(I18N.ja,{'所有已导入出版物':'インポート済みの全出版物','复制':'コピー'});
Object.assign(I18N.ko,{'所有已导入出版物':'가져온 모든 출판물','复制':'복사'});
Object.assign(I18N.en,{'收起栏目':'Collapse sidebar','展开栏目':'Expand sidebar','隐藏目录':'Hide contents','显示目录':'Show contents'});
Object.assign(I18N.ja,{'收起栏目':'サイドバーを折りたたむ','展开栏目':'サイドバーを展開','隐藏目录':'目次を隠す','显示目录':'目次を表示'});
Object.assign(I18N.ko,{'收起栏目':'사이드바 접기','展开栏目':'사이드바 펼치기','隐藏目录':'목차 숨기기','显示目录':'목차 표시'});
Object.assign(I18N.en,{'点击右上角「更多」，从您的设备选择 PUB 文件。':'Tap More in the top-right corner, then choose a PUB file from your device.','未导入的文件默认勾选；已导入的文件默认不勾选；如需覆盖重新解析，请勾选对应文件。':'New files are selected by default; already imported files are not. Tick an imported file to overwrite and re-parse it.'});
Object.assign(I18N.ja,{'点击右上角「更多」，从您的设备选择 PUB 文件。':'右上の「その他」から、お使いのデバイス内のPUBファイルを選択してください。','未导入的文件默认勾选；已导入的文件默认不勾选；如需覆盖重新解析，请勾选对应文件。':'未インポートのファイルは既定で選択され、インポート済みのファイルは選択されません。上書き再解析するには該当ファイルにチェックを入れてください。'});
Object.assign(I18N.ko,{'点击右上角「更多」，从您的设备选择 PUB 文件。':'오른쪽 위 「더보기」를 누른 다음 기기에서 PUB 파일을 선택하십시오.','未导入的文件默认勾选；已导入的文件默认不勾选；如需覆盖重新解析，请勾选对应文件。':'가져오지 않은 파일은 기본으로 선택되고 가져온 파일은 선택되지 않습니다. 덮어쓰기로 다시 분석하려면 해당 파일을 선택하십시오.'});
Object.assign(I18N.en,{"未命名出版物":"Untitled publication","点击阅读今天的经文。":"Read today’s verse.","没有可显示的内容。":"No content to display.","这条相关文章的正文没有保存在本机。":"The text for this related article is not stored on this device.","它很可能是在旧版（0.5.1 及更早）导入的；旧版只保存了链接和标题，没有保存 Extract 正文。请重新导入这份 PUB，或从包含正文的备份恢复后再试。":"It was probably imported with an older version (0.5.1 or earlier), which saved only the link and title, not the Extract text. Re-import this PUB, or restore from a backup that contains the text, and try again.","这条注释没有可显示的正文。":"No readable text for this note.","文章章节":"Article section","研究注释":"Study note"});
Object.assign(I18N.ja,{"未命名出版物":"無題の出版物","点击阅读今天的经文。":"今日の聖句を読む。","没有可显示的内容。":"表示できる内容がありません。","这条相关文章的正文没有保存在本机。":"この関連記事の本文はこの端末に保存されていません。","它很可能是在旧版（0.5.1 及更早）导入的；旧版只保存了链接和标题，没有保存 Extract 正文。请重新导入这份 PUB，或从包含正文的备份恢复后再试。":"旧版（0.5.1以前）でインポートされた可能性があります。旧版はリンクとタイトルだけを保存し、Extract本文を保存していません。このPUBを再インポートするか、本文を含むバックアップから復元して再試行してください。","这条注释没有可显示的正文。":"この注釈には表示できる本文がありません。","文章章节":"記事の章","研究注释":"研究注釈"});
Object.assign(I18N.ko,{"未命名出版物":"제목 없는 출판물","点击阅读今天的经文。":"오늘의 성구 읽기.","没有可显示的内容。":"표시할 내용이 없습니다.","这条相关文章的正文没有保存在本机。":"이 관련 기사의 본문이 이 기기에 저장되어 있지 않습니다.","它很可能是在旧版（0.5.1 及更早）导入的；旧版只保存了链接和标题，没有保存 Extract 正文。请重新导入这份 PUB，或从包含正文的备份恢复后再试。":"구버전(0.5.1 이하)에서 가져왔을 가능성이 있습니다. 구버전은 링크와 제목만 저장하고 Extract 본문은 저장하지 않았습니다. 이 PUB를 다시 가져오거나 본문이 포함된 백업에서 복원한 뒤 다시 시도하십시오.","这条注释没有可显示的正文。":"이 주석에는 표시할 본문이 없습니다.","文章章节":"기사 장","研究注释":"연구 주석"});
Object.assign(I18N.en,{"保存失败":"Save failed","已识别经文位置，但本地没有经文正文":"Verse location recognised, but no local verse text","找不到经文索引":"Verse index not found","拼音自检":"Pinyin self-check","无法显示章节":"Cannot display chapter","本地没有对应的研究注释":"No local study note for this reference","本地没有这条链接的正文":"No local text for this link","正在升级本地数据":"Upgrading local data","部分数据未升级":"Some data was not upgraded"});
Object.assign(I18N.ja,{"保存失败":"保存に失敗","已识别经文位置，但本地没有经文正文":"聖句の位置は特定しましたが、ローカルに本文がありません","找不到经文索引":"聖句索引が見つかりません","拼音自检":"ピンイン自己診断","无法显示章节":"章を表示できません","本地没有对应的研究注释":"ローカルに対応する研究注釈がありません","本地没有这条链接的正文":"このリンクの本文がローカルにありません","正在升级本地数据":"ローカルデータを更新中","部分数据未升级":"一部のデータを更新できませんでした"});
Object.assign(I18N.ko,{"保存失败":"저장 실패","已识别经文位置，但本地没有经文正文":"성구 위치는 확인했지만 로컬 본문이 없습니다","找不到经文索引":"성구 색인을 찾을 수 없습니다","拼音自检":"병음 자체 점검","无法显示章节":"장을 표시할 수 없음","本地没有对应的研究注释":"로컬에 해당 연구 주석이 없습니다","本地没有这条链接的正文":"이 링크의 로컬 본문이 없습니다","正在升级本地数据":"로컬 데이터 업그레이드 중","部分数据未升级":"일부 데이터를 업그레이드하지 못했습니다"});
Object.assign(I18N.en,{"图书馆":"Library","离线阅读":"Offline reading","本书目录":"Contents of this book","轻触框外区域或点关闭按钮":"Tap outside or use the close button","按类型浏览":"Browse by type"});
Object.assign(I18N.ja,{"图书馆":"図書館","离线阅读":"オフライン閲覧","本书目录":"この本の目次","轻触框外区域或点关闭按钮":"外側をタップするか、閉じるボタンを使用してください","按类型浏览":"種類別に閲覧"});
Object.assign(I18N.ko,{"图书馆":"라이브러리","离线阅读":"오프라인 읽기","本书目录":"이 책의 목차","轻触框外区域或点关闭按钮":"바깥을 누르거나 닫기 버튼을 사용하십시오","按类型浏览":"유형별 찾아보기"});
Object.assign(I18N.en,{"打开阅读":"Read","查看目录":"View contents","正在读取诊断信息…":"Reading diagnostics…","读取诊断信息失败：":"Could not read diagnostics: ","点击任意记录直接回到上次阅读的文章和位置。":"Tap an entry to return to the article and position where you left off.","导入、备份、诊断和设置。":"Import, backup, diagnostics and settings.","今日经文、收藏和最近导入。":"Daily text, favourites and recent imports.","选择译本、经卷和章节；其他出版物中的经文链接也会使用这里的本地经文。":"Choose a version, book and chapter. Verse links from other publications also use the local Bible here.","点击阅读今天全文":"Read today’s full text"});
Object.assign(I18N.ja,{"打开阅读":"読む","查看目录":"目次を見る","正在读取诊断信息…":"診断情報を読み込み中…","读取诊断信息失败：":"診断情報の読み込みに失敗：","点击任意记录直接回到上次阅读的文章和位置。":"記録をタップすると、前回読んだ記事と位置に戻ります。","导入、备份、诊断和设置。":"インポート、バックアップ、診断、設定。","今日经文、收藏和最近导入。":"今日の聖句、お気に入り、最近のインポート。","选择译本、经卷和章节；其他出版物中的经文链接也会使用这里的本地经文。":"翻訳・書・章を選択します。他の出版物の聖句リンクもここのローカル聖書を使います。","点击阅读今天全文":"今日の全文を読む"});
Object.assign(I18N.ko,{"打开阅读":"읽기","查看目录":"목차 보기","正在读取诊断信息…":"진단 정보를 읽는 중…","读取诊断信息失败：":"진단 정보를 읽지 못했습니다: ","点击任意记录直接回到上次阅读的文章和位置。":"기록을 누르면 마지막으로 읽던 기사와 위치로 돌아갑니다.","导入、备份、诊断和设置。":"가져오기, 백업, 진단 및 설정.","今日经文、收藏和最近导入。":"오늘의 성구, 즐겨찾기, 최근 가져온 자료.","选择译本、经卷和章节；其他出版物中的经文链接也会使用这里的本地经文。":"번역판, 책, 장을 선택하십시오. 다른 출판물의 성구 링크도 여기의 로컬 성경을 사용합니다.","点击阅读今天全文":"오늘의 전체 본문 읽기"});
Object.assign(I18N.en,{"主导航":"Main navigation","阅读器导航":"Reader navigation","内容操作":"Content actions","链接内容":"Linked content","黄色高亮":"Yellow highlight","绿色高亮":"Green highlight","蓝色高亮":"Blue highlight","粉色高亮":"Pink highlight","红色高亮":"Red highlight"});
Object.assign(I18N.ja,{"主导航":"メインナビゲーション","阅读器导航":"リーダーナビゲーション","内容操作":"コンテンツ操作","链接内容":"リンク内容","黄色高亮":"黄色のハイライト","绿色高亮":"緑のハイライト","蓝色高亮":"青のハイライト","粉色高亮":"ピンクのハイライト","红色高亮":"赤のハイライト"});
Object.assign(I18N.ko,{"主导航":"기본 탐색","阅读器导航":"리더 탐색","内容操作":"콘텐츠 작업","链接内容":"링크 내용","黄色高亮":"노랑 강조","绿色高亮":"초록 강조","蓝色高亮":"파랑 강조","粉色高亮":"분홍 강조","红色高亮":"빨강 강조"});
Object.assign(I18N.en,{"上一节":"Previous section","下一节":"Next section","放大字号":"Larger text","缩小字号":"Smaller text"});
Object.assign(I18N.ja,{"上一节":"前の節","下一节":"次の節","放大字号":"文字を大きく","缩小字号":"文字を小さく"});
Object.assign(I18N.ko,{"上一节":"이전 절","下一节":"다음 절","放大字号":"글자 크게","缩小字号":"글자 작게"});
Object.assign(I18N.en,{"前一日":"Previous day","后一日":"Next day","段落信息":"Paragraph information","段落笔记":"Paragraph note","这一段没有可显示的脚注或相关链接。":"This paragraph has no footnotes or related links.","本地没有对应经文正文":"No local text for this verse","无法读取这一段的信息。":"Could not read this paragraph's information.","本周聚会安排、聚会工作手册和其他聚会资料。":"This week’s meeting schedule, Meeting Workbooks and other meeting material.","本地没有这篇相关文章的正文。":"The linked article is not available locally."});
Object.assign(I18N.ja,{"前一日":"前日","后一日":"翌日","段落信息":"段落情報","段落笔记":"段落ノート","这一段没有可显示的脚注或相关链接。":"この段落には表示できる脚注や関連リンクがありません。","本地没有对应经文正文":"ローカルに対応する聖句本文がありません","无法读取这一段的信息。":"この段落の情報を読み取れませんでした。","本周聚会安排、聚会工作手册和其他聚会资料。":"今週の集会の予定、集会ワークブック、その他の集会資料です。","本地没有这篇相关文章的正文。":"リンク先の記事の本文がローカルにありません。"});
Object.assign(I18N.ko,{"前一日":"이전 날","后一日":"다음 날","段落信息":"문단 정보","段落笔记":"문단 노트","这一段没有可显示的脚注或相关链接。":"이 문단에는 표시할 각주나 관련 링크가 없습니다.","本地没有对应经文正文":"로컬에 해당 성구 본문이 없습니다","无法读取这一段的信息。":"이 문단의 정보를 읽을 수 없습니다.","本周聚会安排、聚会工作手册和其他聚会资料。":"이번 주 집회 일정, 집회 교재 및 기타 집회 자료입니다.","本地没有这篇相关文章的正文。":"연결된 기사의 본문이 로컬에 없습니다."});
Object.assign(I18N.en,{"书签": "Bookmark", "已书签": "Bookmarked", "备份与恢复": "Backup & restore", "设置与诊断": "Settings & diagnostics", "返回": "Back", "高亮颜色": "Highlight colour", "继续": "Continue", "正在恢复图书馆": "Restoring library", "恢复完成": "Restore complete", "恢复失败": "Restore failed", "正在读取备份文件…": "Reading the backup file…", "备份失败": "Backup failed", "正在备份图书馆": "Backing up library", "无法打开圣经": "Cannot open the Bible", "找不到该出版物的数据。": "Data for this publication was not found.", "无法打开": "Cannot open", "对应出版物可能已被删除。": "The publication may have been deleted.", "高亮范围": "Highlight range", "请在同一段文字内选择需要高亮的内容。": "Select text within a single paragraph to highlight.", "已有高亮": "Already highlighted", "这个范围已经有高亮。": "This range is already highlighted.", "缺少经文正文": "Verse text missing", "这份出版物没有保存 BibleVerse 经文数据。请先导入对应语言的圣经 PUB。": "This publication has no BibleVerse data. Import a Bible PUB in the matching language first.", "经文范围过大": "Too many verses", "本阅读器一次最多显示 120 节，请缩小经文范围。": "The reader shows at most 120 verses at a time. Narrow the range.", "没有经文正文": "No verse text", "这份圣经文件中没有找到对应经文正文。": "The matching verse text was not found in this Bible file.", "已检查本机导入的圣经译本，但没有找到这段经文的可显示正文。": "Imported Bibles were checked, but no readable text was found for this passage.", "暂不支持的内部链接": "Unsupported internal link", "当前版本无法识别这个 PUB 内部链接格式。已支持出版物段落链接和圣经经文链接；研究注释会在本地出版物包含对应 Commentary 数据时尝试预览。": "This PUB link format is not recognised. Publication paragraph links and Bible verse links are supported; study notes are previewed when the local publication includes Commentary data.", "离线链接不可用": "Offline link unavailable", "这是一个外部网页链接，当前离线阅读器不会尝试联网打开。": "This is an external web link. The offline reader does not open network links.", "本地存储不可用": "Local storage unavailable", "当前浏览器或容器未允许本地存储，无法保存图书：": "This browser or container does not allow local storage, so books cannot be saved: ", "诊断信息已复制到剪贴板。": "Diagnostics copied to the clipboard.", "使用说明内容": "This is a single-file offline library. Bottom navigation: Home, Bible, Media Library, Meetings, Personal Study. Tap once to return to the last position; double-tap to reset. To import, tap More in the top-right corner and choose PUB files from your device; new files are selected, already imported files are not. Export a full backup regularly. Use the arrow keys to turn pages while reading."});
Object.assign(I18N.ja,{"书签": "ブックマーク", "已书签": "登録済み", "备份与恢复": "バックアップと復元", "设置与诊断": "設定と診断", "返回": "戻る", "高亮颜色": "ハイライト色", "继续": "続行", "正在恢复图书馆": "図書館を復元中", "恢复完成": "復元完了", "恢复失败": "復元に失敗", "正在读取备份文件…": "バックアップファイルを読み込み中…", "备份失败": "バックアップに失敗", "正在备份图书馆": "図書館をバックアップ中", "无法打开圣经": "聖書を開けません", "找不到该出版物的数据。": "この出版物のデータが見つかりません。", "无法打开": "開けません", "对应出版物可能已被删除。": "出版物が削除された可能性があります。", "高亮范围": "ハイライト範囲", "请在同一段文字内选择需要高亮的内容。": "同じ段落内の文字を選択してください。", "已有高亮": "ハイライト済み", "这个范围已经有高亮。": "この範囲はすでにハイライトされています。", "缺少经文正文": "聖句本文がありません", "这份出版物没有保存 BibleVerse 经文数据。请先导入对应语言的圣经 PUB。": "この出版物にはBibleVerseデータがありません。対応言語の聖書PUBを先にインポートしてください。", "经文范围过大": "聖句の範囲が広すぎます", "本阅读器一次最多显示 120 节，请缩小经文范围。": "一度に表示できるのは120節までです。範囲を狭めてください。", "没有经文正文": "聖句本文がありません", "这份圣经文件中没有找到对应经文正文。": "この聖書ファイルに対応する聖句本文が見つかりません。", "已检查本机导入的圣经译本，但没有找到这段经文的可显示正文。": "インポート済みの聖書を確認しましたが、この箇所の本文が見つかりません。", "暂不支持的内部链接": "未対応の内部リンク", "当前版本无法识别这个 PUB 内部链接格式。已支持出版物段落链接和圣经经文链接；研究注释会在本地出版物包含对应 Commentary 数据时尝试预览。": "このPUB内部リンク形式には対応していません。出版物の段落リンクと聖句リンクには対応しています。研究注釈はローカル出版物にCommentaryデータがある場合にプレビューします。", "离线链接不可用": "オフラインリンクは利用できません", "这是一个外部网页链接，当前离线阅读器不会尝试联网打开。": "これは外部ウェブリンクです。オフラインリーダーはネットワークを開きません。", "本地存储不可用": "ローカル保存を利用できません", "当前浏览器或容器未允许本地存储，无法保存图书：": "このブラウザまたはコンテナではローカル保存が許可されていないため、書籍を保存できません：", "诊断信息已复制到剪贴板。": "診断情報をクリップボードにコピーしました。", "使用说明内容": "これは単一HTMLのオフライン図書館です。下部ナビゲーション：ホーム、聖書、マルチメディア図書館、集会、個人研究。1回タップで前回の位置へ、2回タップで先頭へ戻ります。PUBのインポートは右上の「その他」から行い、お使いのデバイスからファイルを選択します。未インポートのファイルは選択済み、インポート済みは未選択です。定期的に完全バックアップを書き出してください。読書中は左右の矢印キーでページを移動できます。"});
Object.assign(I18N.ko,{"书签": "책갈피", "已书签": "저장됨", "备份与恢复": "백업 및 복원", "设置与诊断": "설정 및 진단", "返回": "뒤로", "高亮颜色": "강조 색", "继续": "계속", "正在恢复图书馆": "라이브러리 복원 중", "恢复完成": "복원 완료", "恢复失败": "복원 실패", "正在读取备份文件…": "백업 파일을 읽는 중…", "备份失败": "백업 실패", "正在备份图书馆": "라이브러리 백업 중", "无法打开圣经": "성경을 열 수 없음", "找不到该出版物的数据。": "이 출판물의 데이터를 찾을 수 없습니다.", "无法打开": "열 수 없음", "对应出版物可能已被删除。": "출판물이 삭제되었을 수 있습니다.", "高亮范围": "강조 범위", "请在同一段文字内选择需要高亮的内容。": "같은 문단 안의 텍스트를 선택하십시오.", "已有高亮": "이미 강조됨", "这个范围已经有高亮。": "이 범위는 이미 강조되어 있습니다.", "缺少经文正文": "성구 본문 없음", "这份出版物没有保存 BibleVerse 经文数据。请先导入对应语言的圣经 PUB。": "이 출판물에는 BibleVerse 데이터가 없습니다. 해당 언어의 성경 PUB를 먼저 가져오십시오.", "经文范围过大": "성구 범위가 너무 큼", "本阅读器一次最多显示 120 节，请缩小经文范围。": "한 번에 최대 120절까지 표시합니다. 범위를 줄이십시오.", "没有经文正文": "성구 본문 없음", "这份圣经文件中没有找到对应经文正文。": "이 성경 파일에서 해당 성구 본문을 찾지 못했습니다.", "已检查本机导入的圣经译本，但没有找到这段经文的可显示正文。": "가져온 성경을 확인했지만 이 구절의 본문을 찾지 못했습니다.", "暂不支持的内部链接": "지원하지 않는 내부 링크", "当前版本无法识别这个 PUB 内部链接格式。已支持出版物段落链接和圣经经文链接；研究注释会在本地出版物包含对应 Commentary 数据时尝试预览。": "이 PUB 내부 링크 형식은 인식할 수 없습니다. 출판물 문단 링크와 성구 링크는 지원합니다. 연구 주석은 로컬 출판물에 Commentary 데이터가 있을 때 미리 보기합니다.", "离线链接不可用": "오프라인 링크 사용 불가", "这是一个外部网页链接，当前离线阅读器不会尝试联网打开。": "외부 웹 링크입니다. 오프라인 리더는 네트워크를 열지 않습니다.", "本地存储不可用": "로컬 저장소 사용 불가", "当前浏览器或容器未允许本地存储，无法保存图书：": "이 브라우저 또는 컨테이너에서 로컬 저장소가 허용되지 않아 책을 저장할 수 없습니다: ", "诊断信息已复制到剪贴板。": "진단 정보를 클립보드에 복사했습니다.", "使用说明内容": "단일 HTML 오프라인 라이브러리입니다. 하단 탐색: 홈, 성경, 멀티미디어 라이브러리, 집회, 개인 연구. 한 번 누르면 마지막 위치로, 두 번 누르면 맨 위로 돌아갑니다. PUB 가져오기는 오른쪽 위 「더보기」에서 하며 기기에서 파일을 선택합니다. 가져오지 않은 파일은 선택되고 가져온 파일은 선택되지 않습니다. 정기적으로 전체 백업을 내보내십시오. 읽는 동안 좌우 화살표 키로 페이지를 넘길 수 있습니다."});
Object.assign(I18N.en,{"分享 / 导出…":"Share / export…","导出原始 JWPUB":"Export original JWPUB","关联原始 PUB 文件…":"Link original PUB file…","重新关联原始 PUB 文件…":"Re-link original PUB file…","重新关联原始 PUB 文件":"Re-link original PUB file","这会替换已保存的原始包。继续？":"This will replace the saved original package. Continue?","保留原始包以便分享":"Keep original package for sharing","开启后，导入的 PUB 会在应用内保留完整原始文件，便于以后逐字节导出 JWPUB。会占用更多空间。":"When enabled, imported PUBs keep a complete copy of the original file inside the app so the exact JWPUB can be exported later. This uses more space.","已关闭原始包保存；已保存的原始包不会被删除。":"Original-package storage is off; existing packages are kept.","正在读取原始 PUB":"Reading original PUB","正在提取 SQLite 和内层文件…":"Extracting SQLite and inner files…","关联完成":"Link complete","现在可以导出原始 JWPUB。":"You can now export the original JWPUB.","关联失败":"Link failed","没有保存原始包。请重新导入原 PUB。":"No original package is saved. Re-import the original PUB.","正在生成 JWPUB":"Building JWPUB","正在打包…":"Packing…","JWPUB 已导出":"JWPUB exported","导出失败":"Export failed","原始包":"Original package"});
Object.assign(I18N.ja,{"分享 / 导出…":"共有 / 書き出し…","导出原始 JWPUB":"元のJWPUBを書き出す","关联原始 PUB 文件…":"元のPUBファイルを関連付け…","重新关联原始 PUB 文件…":"元のPUBファイルを再関連付け…","重新关联原始 PUB 文件":"元のPUBファイルを再関連付け","这会替换已保存的原始包。继续？":"保存済みの元パッケージを置き換えます。続行しますか？","保留原始包以便分享":"共有用に元パッケージを保持","开启后，导入的 PUB 会在应用内保留完整原始文件，便于以后逐字节导出 JWPUB。会占用更多空间。":"有効にすると、インポートしたPUBの完全な元ファイルをアプリ内に保持し、後でJWPUBをそのまま書き出せます。容量を使います。","已关闭原始包保存；已保存的原始包不会被删除。":"元パッケージの保存はオフです。保存済みのパッケージは残ります。","正在读取原始 PUB":"元のPUBを読み込み中","正在提取 SQLite 和内层文件…":"SQLiteと内部ファイルを抽出中…","关联完成":"関連付け完了","现在可以导出原始 JWPUB。":"元のJWPUBを書き出せるようになりました。","关联失败":"関連付け失敗","没有保存原始包。请重新导入原 PUB。":"元パッケージが保存されていません。元のPUBを再インポートしてください。","正在生成 JWPUB":"JWPUBを生成中","正在打包…":"パッケージ中…","JWPUB 已导出":"JWPUBを書き出しました","导出失败":"書き出し失敗","原始包":"元パッケージ"});
Object.assign(I18N.ko,{"分享 / 导出…":"공유 / 내보내기…","导出原始 JWPUB":"원본 JWPUB 내보내기","关联原始 PUB 文件…":"원본 PUB 파일 연결…","重新关联原始 PUB 文件…":"원본 PUB 파일 다시 연결…","重新关联原始 PUB 文件":"원본 PUB 파일 다시 연결","这会替换已保存的原始包。继续？":"저장된 원본 패키지를 교체합니다. 계속하시겠습니까?","保留原始包以便分享":"공유를 위해 원본 패키지 보관","开启后，导入的 PUB 会在应用内保留完整原始文件，便于以后逐字节导出 JWPUB。会占用更多空间。":"켜면 가져온 PUB의 전체 원본 파일을 앱 안에 보관하여 나중에 JWPUB를 그대로 내보낼 수 있습니다. 공간을 더 사용합니다.","已关闭原始包保存；已保存的原始包不会被删除。":"원본 패키지 보관이 꺼져 있습니다. 저장된 패키지는 유지됩니다.","正在读取原始 PUB":"원본 PUB 읽는 중","正在提取 SQLite 和内层文件…":"SQLite와 내부 파일 추출 중…","关联完成":"연결 완료","现在可以导出原始 JWPUB。":"이제 원본 JWPUB를 내보낼 수 있습니다.","关联失败":"연결 실패","没有保存原始包。请重新导入原 PUB。":"저장된 원본 패키지가 없습니다. 원본 PUB를 다시 가져오십시오.","正在生成 JWPUB":"JWPUB 생성 중","正在打包…":"패키징 중…","JWPUB 已导出":"JWPUB를 내보냈습니다","导出失败":"내보내기 실패","原始包":"원본 패키지"});
Object.assign(I18N.en,{"重新导入以启用分享…":"Re-import to enable sharing…","重新导入以启用分享":"Re-import to enable sharing","这本书缺少分享所需的原始包。请选择原 PUB 重新导入；导入后原文件可以删除。":"This book has no original package for sharing. Choose the original PUB to re-import; the original file can be deleted afterwards.","选择文件":"Choose file","导入后会保留原始包以便以后分享，可在设置中关闭。":"Imports will keep the original package for later sharing; you can turn this off in Settings."});
Object.assign(I18N.ja,{"重新导入以启用分享…":"共有を有効にするため再インポート…","重新导入以启用分享":"共有を有効にするため再インポート","这本书缺少分享所需的原始包。请选择原 PUB 重新导入；导入后原文件可以删除。":"この本には共有用の元パッケージがありません。元のPUBを選択して再インポートしてください。インポート後、元ファイルは削除できます。","选择文件":"ファイルを選択","导入后会保留原始包以便以后分享，可在设置中关闭。":"インポート時に共有用の元パッケージを保持します。設定でオフにできます。"});
Object.assign(I18N.ko,{"重新导入以启用分享…":"공유를 위해 다시 가져오기…","重新导入以启用分享":"공유를 위해 다시 가져오기","这本书缺少分享所需的原始包。请选择原 PUB 重新导入；导入后原文件可以删除。":"이 책에는 공유용 원본 패키지가 없습니다. 원본 PUB를 선택해 다시 가져오십시오. 가져온 후 원본 파일은 삭제할 수 있습니다.","选择文件":"파일 선택","导入后会保留原始包以便以后分享，可在设置中关闭。":"가져올 때 공유용 원본 패키지를 보관합니다. 설정에서 끌 수 있습니다."});
Object.assign(I18N.en,{"导出 / 分享原始 JWPUB…":"Export / share original JWPUB…","分享 / 保存（原文件名）":"Share / save (original filename)","分享 / 保存（易读名称）":"Share / save (readable name)","无法直接分享":"Cannot share directly","当前容器无法分享文件，请改用桌面浏览器保存，或从文件 App 分享。":"This container cannot share files. Save with a desktop browser or share from the Files app."});
Object.assign(I18N.ja,{"导出 / 分享原始 JWPUB…":"元のJWPUBを書き出す / 共有…","分享 / 保存（原文件名）":"共有 / 保存（元のファイル名）","分享 / 保存（易读名称）":"共有 / 保存（読みやすい名前）","无法直接分享":"直接共有できません","当前容器无法分享文件，请改用桌面浏览器保存，或从文件 App 分享。":"このコンテナはファイルを共有できません。デスクトップのブラウザで保存するか、ファイルAppから共有してください。"});
Object.assign(I18N.ko,{"导出 / 分享原始 JWPUB…":"원본 JWPUB 내보내기 / 공유…","分享 / 保存（原文件名）":"공유 / 저장 (원본 파일 이름)","分享 / 保存（易读名称）":"공유 / 저장 (읽기 쉬운 이름)","无法直接分享":"직접 공유할 수 없음","当前容器无法分享文件，请改用桌面浏览器保存，或从文件 App 分享。":"이 컨테이너는 파일을 공유할 수 없습니다. 데스크톱 브라우저에서 저장하거나 파일 앱에서 공유하십시오."});
Object.assign(I18N.en,{"从原始包读取正文（实验）":"Read text from original package (experimental)","开启后，打开有原始包的出版物时，会直接从原始 SQLite 查询并解密当前文档；失败时回退到解析数据。":"When enabled, opening a publication with an original package queries and decrypts the current document directly from the original SQLite; on failure it falls back to parsed data.","实验功能已关闭。":"Experimental feature off."});
Object.assign(I18N.ja,{"从原始包读取正文（实验）":"元パッケージから本文を読む（実験）","开启后，打开有原始包的出版物时，会直接从原始 SQLite 查询并解密当前文档；失败时回退到解析数据。":"有効にすると、元パッケージのある出版物を開くとき、元のSQLiteから現在の文書を取得・復号します。失敗時は解析データに戻ります。","实验功能已关闭。":"実験機能をオフにしました。"});
Object.assign(I18N.ko,{"从原始包读取正文（实验）":"원본 패키지에서 본문 읽기 (실험)","开启后，打开有原始包的出版物时，会直接从原始 SQLite 查询并解密当前文档；失败时回退到解析数据。":"켜면 원본 패키지가 있는 출판물을 열 때 원본 SQLite에서 현재 문서를 조회하고 복호화합니다. 실패하면 분석 데이터로 돌아갑니다.","实验功能已关闭。":"실험 기능이 꺼졌습니다."});
Object.assign(I18N.en,{"当前出版物":"Current publication","当前分类":"Current category","所选出版物":"Selected publications","全部出版物":"All publications","还没有选择出版物。":"No publications selected yet.","已选择":"Selected","本出版物":"publications","选择出版物…":"Choose publications…","选择要搜索的出版物":"Choose publications to search","还没有导入出版物。":"No publications imported yet.","全选":"Select all","清空":"Clear","完成":"Done","共":"","条结果":"results","条":"hits","章":"chapters","展开其余":"Show remaining","结果较多，已显示前面的部分。可以缩小搜索范围。":"Many results; only the first part is shown. Narrow the search scope to see more."});
Object.assign(I18N.ja,{"当前出版物":"現在の出版物","当前分类":"現在のカテゴリ","所选出版物":"選択した出版物","全部出版物":"すべての出版物","还没有选择出版物。":"出版物が選択されていません。","已选择":"選択済み","本出版物":"件","选择出版物…":"出版物を選択…","选择要搜索的出版物":"検索する出版物を選択","还没有导入出版物。":"出版物がまだありません。","全选":"すべて選択","清空":"クリア","完成":"完了","共":"","条结果":"件の結果","条":"件","章":"章","展开其余":"残りを表示","结果较多，已显示前面的部分。可以缩小搜索范围。":"結果が多いため、先頭のみ表示しています。検索範囲を狭めてください。"});
Object.assign(I18N.ko,{"当前出版物":"현재 출판물","当前分类":"현재 분류","所选出版物":"선택한 출판물","全部出版物":"모든 출판물","还没有选择出版物。":"선택한 출판물이 없습니다.","已选择":"선택됨","本出版物":"개","选择出版物…":"출판물 선택…","选择要搜索的出版物":"검색할 출판물 선택","还没有导入出版物。":"아직 가져온 출판물이 없습니다.","全选":"모두 선택","清空":"지우기","完成":"완료","共":"","条结果":"개 결과","条":"개","章":"장","展开其余":"나머지 보기","结果较多，已显示前面的部分。可以缩小搜索范围。":"결과가 많아 앞부분만 표시합니다. 검색 범위를 좁혀 보십시오."});
Object.assign(I18N.en,{"以原始包为主（实验）":"Use original package as primary (experimental)","开启后，新导入的出版物只保留目录/元数据，正文从原始包按需读取；旧书不受影响，重新导入后才会切换。已清理的正文不会自动恢复。":"When enabled, newly imported publications keep only metadata; bodies are read from the original package on demand. Existing books are unchanged until re-imported. Cleared bodies are not restored automatically.","开启":"Enable","已开启。重新导入出版物后生效。":"Enabled. Re-import publications to apply.","已关闭。已清理的正文需要重新导入才能恢复。":"Disabled. Cleared bodies require a re-import to restore."});
Object.assign(I18N.ja,{"以原始包为主（实验）":"元パッケージを優先（実験）","开启后，新导入的出版物只保留目录/元数据，正文从原始包按需读取；旧书不受影响，重新导入后才会切换。已清理的正文不会自动恢复。":"有効にすると、新しくインポートした出版物はメタデータのみを保持し、本文は元パッケージから必要時に読み込みます。既存の本は再インポートするまで変わりません。削除された本文は自動復元されません。","开启":"有効にする","已开启。重新导入出版物后生效。":"有効にしました。出版物を再インポートすると適用されます。","已关闭。已清理的正文需要重新导入才能恢复。":"オフにしました。削除された本文は再インポートで復元できます。"});
Object.assign(I18N.ko,{"以原始包为主（实验）":"원본 패키지 우선 (실험)","开启后，新导入的出版物只保留目录/元数据，正文从原始包按需读取；旧书不受影响，重新导入后才会切换。已清理的正文不会自动恢复。":"켜면 새로 가져온 출판물은 메타데이터만 보관하고 본문은 원본 패키지에서 필요할 때 읽습니다. 기존 책은 다시 가져오기 전까지 그대로입니다. 삭제된 본문은 자동으로 복원되지 않습니다.","开启":"켜기","已开启。重新导入出版物后生效。":"켜졌습니다. 출판물을 다시 가져오면 적용됩니다.","已关闭。已清理的正文需要重新导入才能恢复。":"껐습니다. 삭제된 본문은 다시 가져와야 복원됩니다."});
Object.assign(I18N.en,{"按原始包清理现有书":"Clean existing books from original packages","会清空有原始包的书的解析正文、摘录、研究注释和圣经密文，之后从原始包读取。请先备份。继续？":"This clears parsed body, extracts, study notes and Bible ciphertext for books with an original package, then reads from the package. Back up first. Continue?","清理":"Clean","已处理":"Processed"});
Object.assign(I18N.ja,{"按原始包清理现有书":"既存の本を元パッケージから整理","会清空有原始包的书的解析正文、摘录、研究注释和圣经密文，之后从原始包读取。请先备份。继续？":"元パッケージのある本の解析本文、抜粋、研究注釈、聖書の暗号文を消去し、以後は元パッケージから読み込みます。先にバックアップしてください。続行しますか？","清理":"整理","已处理":"処理済み"});
Object.assign(I18N.ko,{"按原始包清理现有书":"기존 책을 원본 패키지 기준으로 정리","会清空有原始包的书的解析正文、摘录、研究注释和圣经密文，之后从原始包读取。请先备份。继续？":"원본 패키지가 있는 책의 분석 본문, 발췌, 연구 주석, 성경 암호문을 지우고 이후 원본 패키지에서 읽습니다. 먼저 백업하십시오. 계속하시겠습니까?","清理":"정리","已处理":"처리됨"});
const UI_ICONS={
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  more:'<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.2" stroke-linecap="round"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  star:'<path d="m12 3.8 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.9l5.8-.8z"/>',
  starOn:'<path d="m12 3.8 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.9l5.8-.8z" fill="currentColor"/>',
  note:'<path d="M5.5 4.5h13v10.2l-4.8 4.8H5.5z"/><path d="M18.5 14.7h-4.8v4.8"/><path d="M12 8.4v4.8M9.6 10.8h4.8"/>',
  left:'<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  right:'<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  up:'<path d="M6 14.5 12 8.5l6 6"/>',
  down:'<path d="M6 9.5 12 15.5l6-6"/>',
  collapse:'<path d="M5 8.5 12 15.5l7-7"/>',
  book:'<path d="M4 5.5c2.8-.8 5.1-.2 8 1.4v13c-2.9-1.6-5.2-2.2-8-1.4z"/><path d="M20 5.5c-2.8-.8-5.1-.2-8 1.4v13c2.9-1.6 5.2-2.2 8-1.4z"/>',
  books:'<path d="M4 7.5h5v12H4zM10.5 5h4v14.5h-4zM16 8h4v11.5h-4z"/>',
  magazine:'<path d="M5 4.5h14v15H5z"/><path d="M8 8h5M8 11.5h5M8 15h8"/>',
  file:'<path d="M6 3.5h7l5 5v12H6z"/><path d="M13 3.5v5h5"/>',
  calendar:'<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>',
  search:'<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4.2 4.2"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
  music:'<path d="M9 18.5V6l10-2v12.5"/><circle cx="6.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  folder:'<path d="M3.5 6.5h6l2 2.5h9v11h-17z"/>',
  help:'<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2-2.5 3.7"/><path d="M12 17.2h.01"/>',
  download:'<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 18.5h15"/>',
  upload:'<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 18.5h15"/>',
  share:'<circle cx="18" cy="5" r="2.4"/><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="19" r="2.4"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7"/>',
  language:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5S14.5 18.1 12 20.5c-2.5-2.4-3.8-5.3-3.8-8.5S9.5 5.9 12 3.5z"/>',
  history:'<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6.1"/><path d="M20.6 3.4v4.8h-4.8"/><path d="M12 7.6V12l3.1 1.9"/>',
  pencil:'<path d="M4 20l4.1-1 10-10-3.1-3.1-10 10z"/><path d="M13.9 6.8l3.1 3.1"/>',
  trash:'<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.8 6.5l.8 13h8.8l.8-13M10.5 10v6M13.5 10v6"/>',
  tag:'<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8.2" cy="8.2" r="1.3"/>'
};
function svgIcon(name,size){
  const n=Number(size)||24;
  return '<svg viewBox="0 0 24 24" width="'+n+'" height="'+n+'" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(UI_ICONS[name]||UI_ICONS.help)+'</svg>';
}
function t(s){
  if(uiLang==='zh')return s;
  const pack=I18N[uiLang];
  if(pack&&pack[s])return pack[s];
  if(uiLang!=='en'&&I18N.en&&I18N.en[s])return I18N.en[s];
  return s;
}
function renderBookmarkButton(on){
  const b=document.getElementById('bookmarkBtn');if(!b)return;
  const key=on?'已书签':'书签';b.innerHTML='<span class="btn-icon">'+svgIcon(on?'starOn':'star',18)+'</span><span data-i18n="'+key+'">'+t(key)+'</span>';
  b.classList.toggle('is-on',!!on);
  b.setAttribute('aria-pressed',on?'true':'false');
}
function uiLocale(){return (UI_LANGS[uiLang]||UI_LANGS.zh).locale}
let CUSTOM_CATEGORIES=new Map();
const CATEGORY_LABEL_KEYS={
  bible:'圣经',books:'书籍',magazines:'杂志',
  'magazines.watchtower':'守望台','magazines.watchtower.study':'守望台 · 研读版','magazines.watchtower.public':'守望台 · 公众版','magazines.awake':'警醒！','magazines.other':'其他杂志',
  brochures:'册子和单张','brochures.tracts':'单张和邀请函','brochures.booklets':'册子',
  meetings:'聚会资料',reference:'索引和参考资料',daily:'每日经文',songs:'诗歌',other:'其他',uncategorized:'未分类'
};
function catLabel(name){const key=String(name);const custom=CUSTOM_CATEGORIES.get(key);if(custom&&custom.name)return custom.name;return t(CATEGORY_LABEL_KEYS[key]||key)}
function sourceFileName(v){return String(v||'').replace(/\.(jwpub|pub)$/i,'')}
function applyI18n(){
  try{
    document.documentElement.lang=uiLocale();
    document.title=t('我的私人图书馆');
    document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.getAttribute('data-i18n'))});
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{el.placeholder=t(el.getAttribute('data-i18n-placeholder'))});
    document.querySelectorAll('[data-i18n-title]').forEach(el=>{el.title=t(el.getAttribute('data-i18n-title'))});
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el=>{el.setAttribute('aria-label',t(el.getAttribute('data-i18n-aria-label')))});
    const lb=document.getElementById('langBtn');if(lb){lb.textContent=uiLang==='zh'?'中':uiLang==='en'?'EN':uiLang==='ja'?'日':uiLang==='ko'?'한':String(uiLang).toUpperCase();lb.title=t('界面语言')+' · '+((UI_LANGS[uiLang]||UI_LANGS.zh).name||'')}
    const cb=document.getElementById('contentLangBtn');if(cb)cb.textContent='文';
  }catch(e){}
}
const XOR='11cbb5587e32846d4c26790c633da289f66fe5842a3a585ce1bc3a294af5ada7';
function focusSafely(el){if(!el||!el.focus)return;try{el.focus({preventScroll:true})}catch(e){try{el.focus()}catch(err){}}}
function focusablesIn(root){
  if(!root)return [];
  return [...root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&el.getAttribute('aria-hidden')!=='true'&&el.offsetParent!==null);
}
function trapFocus(root,e){
  if(!root||e.key!=='Tab')return false;
  const items=focusablesIn(root);if(!items.length)return false;
  const first=items[0],last=items[items.length-1],active=document.activeElement;
  if(e.shiftKey&&(active===first||!root.contains(active))){e.preventDefault();focusSafely(last);return true}
  if(!e.shiftKey&&(active===last||!root.contains(active))){e.preventDefault();focusSafely(first);return true}
  return false;
}
let modalReturnFocus=null;
const say=(title,msg,busy)=>{
  const m=$('modal');if(m&&m.style.display!=='flex')modalReturnFocus=document.activeElement;
  $('modalTitle').textContent=t(title);$('modalText').textContent=t(msg);
  const ok=$('modalOk');if(ok)ok.style.display=busy?'none':'';
  const x=$('modalClose');if(x)x.style.display=busy?'none':'';
  m.style.display='flex';
  if(!busy)setTimeout(()=>focusSafely(ok),0);
};
function closeModal(){
  const m=$('modal');if(m)m.style.display='none';
  restoreFocus(modalReturnFocus);modalReturnFocus=null;
}
function restoreFocus(el){if(el&&document.contains(el))focusSafely(el)}
function rememberPanelFocus(panel){if(panel&&!panel._returnFocus)panel._returnFocus=document.activeElement}
function restorePanelFocus(panel){if(!panel)return;const el=panel._returnFocus;panel._returnFocus=null;restoreFocus(el)}
function askConfirm(title,message,okLabel){
  return new Promise(resolve=>{
    const m=$('confirmModal');if(!m){resolve(true);return}
    const returnFocus=document.activeElement;
    $('confirmTitle').textContent=t(title);
    $('confirmText').textContent=t(message);
    $('confirmOk').textContent=t(okLabel||'继续');
    $('confirmCancel').textContent=t('取消');
    m.style.display='flex';
    const close=(v)=>{m.style.display='none';m.onclick=null;$('confirmOk').onclick=null;$('confirmCancel').onclick=null;resolve(v);restoreFocus(returnFocus)};
    $('confirmOk').onclick=()=>close(true);
    $('confirmCancel').onclick=()=>close(false);
    m.onclick=e=>{if(e.target===m)close(false)};
    setTimeout(()=>focusSafely($('confirmCancel')),0);
  });
}
function showReaderNav(section){
  readerNavSection=(section==='more'||section==='history')?'study':(section||'study');
  const nav=$('bottomNav');
  if(!nav)return;
  nav.style.display='grid';
  nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.primary===readerNavSection));
}
function restoreReaderScroll(value){
  const v=Number(value||0);if(!v)return;
  const apply=()=>{try{$('readerBody').scrollTop=v}catch(e){}};
  apply();requestAnimationFrame(()=>{apply();requestAnimationFrame(apply)});setTimeout(apply,300);
}
const PinyinDisplay=(()=>{
  try{
    const ok=window.CSS&&typeof CSS.supports==='function';
    return {rubyText:!!(ok&&CSS.supports('display','ruby-text')),revert:!!(ok&&CSS.supports('display','revert'))};
  }catch(e){return {rubyText:false,revert:false}}
})();
function pinyinDisplayValue(){return PinyinDisplay.rubyText?'ruby-text':(PinyinDisplay.revert?'revert':'inline')}
function applyPinyinDom(root){
  const scope=root||document;
  let count=0;
  const display=pinyinDisplayValue();
  try{
    scope.querySelectorAll('rt').forEach(rt=>{
      count++;
      if(pronunciationOn){
        rt.style.setProperty('display',display,'important');
        rt.style.setProperty('font-size','0.62em','important');
        rt.style.setProperty('line-height','1.05','important');
        rt.style.setProperty('color','#5d7079','important');
      }else{
        rt.style.setProperty('display','none','important');
      }
    });
  }catch(e){}
  if(pronunciationOn){
    const check=()=>{
      try{
        const rts=[...scope.querySelectorAll('rt')];
        const first=rts[0];
        if(first&&typeof getComputedStyle==='function'&&getComputedStyle(first).display==='none'){
          rts.forEach(rt=>rt.style.setProperty('display','inline','important'));
        }
      }catch(e){}
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(check);else setTimeout(check,0);
  }
  const btn=$('pronunciationBtn');
  if(btn&&pronunciationOn)btn.title=`拼音：开（${count} 处）`;
}
function setPinyin(on){
  pronunciationOn=!!on;
  try{
    document.documentElement.classList.toggle('pinyin-on',pronunciationOn);
    document.documentElement.classList.toggle('pinyin-fallback',pronunciationOn&&!PinyinDisplay.rubyText&&!PinyinDisplay.revert);
  }catch(e){}
  document.querySelectorAll('[data-pinyin-toggle]').forEach(btn=>{
    btn.classList.toggle('active',pronunciationOn);
    btn.setAttribute('aria-pressed',pronunciationOn?'true':'false');
    btn.title=pronunciationOn?'拼音（点击关闭）':'拼音（点击打开）';
  });
  try{localStorage.setItem('offlineLibraryPronunciation',pronunciationOn?'1':'0')}catch(e){}
  applyPinyinDom(document);
}
function pinyinDebug(){
  const out={enabled:!!pronunciationOn,htmlClass:false,fallback:false,supportsRubyText:PinyinDisplay.rubyText,supportsRevert:PinyinDisplay.revert,displayValue:pinyinDisplayValue(),domRuby:0,domRt:0,storedRuby:null,storedRt:null,inlineStyle:'',computedDisplay:''};
  try{out.htmlClass=document.documentElement.classList.contains('pinyin-on');out.fallback=document.documentElement.classList.contains('pinyin-fallback')}catch(e){}
  try{
    const article=$('article');
    const ruby=article&&article.querySelectorAll?article.querySelectorAll('ruby'):[];
    const rt=article&&article.querySelectorAll?article.querySelectorAll('rt'):[];
    const rts=[];try{for(const x of rt)rts.push(x)}catch(e){}
    out.domRuby=ruby&&typeof ruby.length==='number'?ruby.length:0;out.domRt=rts.length;
    const first=rts[0];
    if(first){
      out.inlineStyle=first.getAttribute('style')||'';
      if(typeof getComputedStyle==='function')out.computedDisplay=getComputedStyle(first).display;
    }
  }catch(e){}
  try{
    const d=(typeof currentBook!=='undefined'&&currentBook&&currentIndex>=0)?currentBook.docs[currentIndex]:null;
    if(d){const h=String(d.html||'');out.storedRuby=(h.match(/<ruby[\s>]/g)||[]).length;out.storedRt=(h.match(/<rt[\s>]/g)||[]).length}
  }catch(e){}
  return out;
}

$('modalOk').onclick=closeModal;
const _modalClose=$('modalClose');if(_modalClose)_modalClose.onclick=closeModal;
document.addEventListener('keydown',e=>{
  const cm=$('confirmModal'),m=$('modal');
  if(e.key==='Escape'){
    if(cm&&cm.style.display==='flex'){const c=$('confirmCancel');if(c)c.click();e.preventDefault();return}
    if(m&&m.style.display==='flex'){if(!$('modalOk')||$('modalOk').style.display!=='none'){closeModal();e.preventDefault()}return}
    const imp=$('importDialog');if(imp&&imp.style.display==='flex'){closeImportDialog();e.preventDefault();return}
    const ae=$('annotationEditor');if(ae&&ae.classList.contains('show')){closeAnnotationEditor();e.preventDefault();return}
    if($('noteEditor')){closeNoteEditor();e.preventDefault();return}
    if($('annotationsPanel').classList.contains('show')){closeAnnotationsPanel();e.preventDefault();return}
    if($('historyPanel').classList.contains('show')){closeHistoryPanel();e.preventDefault();return}
    if($('linkPopover').style.display==='block'){closeLinkPopover();e.preventDefault();return}
    if($('readerSearchPanel').classList.contains('show')){closeReaderSearch();e.preventDefault();return}
    if($('drawer').style.display==='block'){closeDrawer();e.preventDefault();return}
  }
  if(cm&&cm.style.display==='flex')trapFocus(cm,e);
  else if(m&&m.style.display==='flex')trapFocus(m,e);
});
const diagEvents=[];
function logDiag(level,message,detail){
  try{
    diagEvents.push({at:new Date().toISOString(),level:String(level||'info'),message:String(message||''),detail:detail===undefined?null:detail});
    if(diagEvents.length>300)diagEvents.splice(0,diagEvents.length-300);
    try{console[level==='error'?'error':'log']('[offline-library]',message,detail||'')}catch(e){}
  }catch(e){}
}

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{
  const d=req.result;
  for(const name of ['books','notes','bookmarks','history']) if(!d.objectStoreNames.contains(name)) d.createObjectStore(name,{keyPath:'id'});
  if(!d.objectStoreNames.contains('system')) d.createObjectStore('system',{keyPath:'id'});
  if(!d.objectStoreNames.contains('bookMeta')) d.createObjectStore('bookMeta',{keyPath:'id'});
  if(!d.objectStoreNames.contains('bookDocs')){const s=d.createObjectStore('bookDocs',{keyPath:'key'});s.createIndex('byBook','bookId',{unique:false});s.createIndex('byMeps','mepsId',{unique:false});}
  if(!d.objectStoreNames.contains('bookAssets')){const s=d.createObjectStore('bookAssets',{keyPath:'key'});s.createIndex('byBook','bookId',{unique:false});}
  if(!d.objectStoreNames.contains('bookAux')) d.createObjectStore('bookAux',{keyPath:'id'});
  if(!d.objectStoreNames.contains('categories')) d.createObjectStore('categories',{keyPath:'id'});
  if(!d.objectStoreNames.contains('tags')){const s=d.createObjectStore('tags',{keyPath:'id'});s.createIndex('byName','name',{unique:false});}
  if(!d.objectStoreNames.contains('highlights')){const s=d.createObjectStore('highlights',{keyPath:'id'});s.createIndex('byBook','bookId',{unique:false});s.createIndex('byBookDoc',['bookId','docId'],{unique:false});s.createIndex('byNote','noteId',{unique:false});}
};req.onsuccess=()=>{idb=req.result;idb.onversionchange=()=>idb.close();try{navigator.storage?.persist?.().catch(()=>{})}catch(e){}resolve(idb)};req.onerror=()=>reject(req.error)})}
function tx(store,mode='readonly'){return idb.transaction(store,mode).objectStore(store)}
function reqP(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function getOne(store,key){return reqP(tx(store).get(key))}
async function saveOne(store,v){return reqP(tx(store,'readwrite').put(v))}
// The long-term identity follows the same idea as JW Library's own user data:
// language + key symbol + issue. The year is only needed to derive the content
// encryption key, so a new yearly edition of the same publication keeps the
// same notes/highlights instead of looking like a different publication.
function legacyIdFor(b){return [b.lang,b.symbol,b.year,b.issue||0].join('_')}
function keySymbolFor(b){
  const issue=Number(b.issue||0)||0;
  if(!issue)return String(b.symbol||'unknown');
  if(b.undatedSymbol)return String(b.undatedSymbol);
  // Old records/backups have no top-level UndatedSymbol, but they do keep the
  // manifest. Use its undated symbol when available.
  try{
    const mp=b.manifestRaw&&b.manifestRaw.publication;
    if(mp&&mp.undatedSymbol)return String(mp.undatedSymbol);
  }catch(e){}
  // Last resort: strip a trailing year and optional issue suffix
  // (《警》26, w26, mwb26.09 -> 《警》, w, mwb).
  const s=String(b.symbol||'unknown');
  return s.replace(/(?:19|20)?\d{2}(?:[.\-]\d+)?$/,'')||s;
}
function idFor(b){
  const parts=[String(b.lang??0),keySymbolFor(b)];
  const issue=Number(b.issue||0)||0;
  if(issue)parts.push(String(issue));
  return parts.join('_');
}
function shouldMigrateId(b){
  const old=String(b&&b.id);
  return old===legacyIdFor(b)&&old!==idFor(b);
}
function safeText(v){return String(v??'').replace(/[<>]/g,'')}
function bytesHex(s){return new Uint8Array(s.match(/.{2}/g).map(x=>parseInt(x,16)))}
function xor(a,b){const o=new Uint8Array(a.length);for(let i=0;i<a.length;i++)o[i]=a[i]^b[i];return o}
let _aesTables=null;
function aesTables(){
  if(_aesTables)return _aesTables;
  const xtime=a=>((a<<1)^((a&0x80)?0x1b:0))&0xff;
  const exp=new Uint8Array(512),log=new Uint8Array(256);
  let x=1;
  for(let i=0;i<255;i++){exp[i]=x;log[x]=i;x=xtime(x)^x;}
  for(let i=255;i<512;i++)exp[i]=exp[i-255];
  const gmul=(a,b)=>(a&&b)?exp[log[a]+log[b]]:0;
  const rotl8=(a,n)=>((a<<n)|(a>>>(8-n)))&0xff;
  const sbox=new Uint8Array(256),invSbox=new Uint8Array(256);
  for(let a=0;a<256;a++){
    const inv=a?exp[255-log[a]]:0;
    const s=(inv^rotl8(inv,1)^rotl8(inv,2)^rotl8(inv,3)^rotl8(inv,4)^0x63)&0xff;
    sbox[a]=s;invSbox[s]=a;
  }
  const M9=new Uint8Array(256),M11=new Uint8Array(256),M13=new Uint8Array(256),M14=new Uint8Array(256);
  for(let i=0;i<256;i++){M9[i]=gmul(i,9);M11[i]=gmul(i,11);M13[i]=gmul(i,13);M14[i]=gmul(i,14);}
  return (_aesTables={sbox,invSbox,M9,M11,M13,M14});
}
function aesExpandKey(key){
  const {sbox}=aesTables();
  const w=new Uint8Array(176);w.set(key);
  let rcon=1;
  for(let i=4;i<44;i++){
    let t0=w[(i-1)*4],t1=w[(i-1)*4+1],t2=w[(i-1)*4+2],t3=w[(i-1)*4+3];
    if(i%4===0){
      const tmp=t0;
      t0=sbox[t1]^rcon;t1=sbox[t2];t2=sbox[t3];t3=sbox[tmp];
      rcon=((rcon<<1)^((rcon&0x80)?0x1b:0))&0xff;
    }
    w[i*4]=w[(i-4)*4]^t0;w[i*4+1]=w[(i-4)*4+1]^t1;w[i*4+2]=w[(i-4)*4+2]^t2;w[i*4+3]=w[(i-4)*4+3]^t3;
  }
  return w;
}
function invShiftRows(s){
  let t=s[1];s[1]=s[13];s[13]=s[9];s[9]=s[5];s[5]=t;
  t=s[2];s[2]=s[10];s[10]=t;
  t=s[6];s[6]=s[14];s[14]=t;
  t=s[3];s[3]=s[7];s[7]=s[11];s[11]=s[15];s[15]=t;
}
function aesDecryptBlock(input,w){
  const {invSbox,M9,M11,M13,M14}=aesTables();
  const s=new Uint8Array(16);
  for(let i=0;i<16;i++)s[i]=input[i]^w[160+i];
  for(let round=9;round>0;round--){
    invShiftRows(s);
    for(let i=0;i<16;i++)s[i]=invSbox[s[i]];
    for(let i=0;i<16;i++)s[i]^=w[round*16+i];
    for(let c=0;c<4;c++){
      const i=c*4,a0=s[i],a1=s[i+1],a2=s[i+2],a3=s[i+3];
      s[i]=M14[a0]^M11[a1]^M13[a2]^M9[a3];
      s[i+1]=M9[a0]^M14[a1]^M11[a2]^M13[a3];
      s[i+2]=M13[a0]^M9[a1]^M14[a2]^M11[a3];
      s[i+3]=M11[a0]^M13[a1]^M9[a2]^M14[a3];
    }
  }
  invShiftRows(s);
  for(let i=0;i<16;i++)s[i]=invSbox[s[i]];
  for(let i=0;i<16;i++)s[i]^=w[i];
  return s;
}
function aesCbcDecryptBytes(data,key,iv){
  if(data.length%16)throw new Error('AES 密文长度无效');
  const w=aesExpandKey(key);
  const out=new Uint8Array(data.length);
  let prev=iv;
  for(let off=0;off<data.length;off+=16){
    const block=aesDecryptBlock(data.subarray(off,off+16),w);
    for(let i=0;i<16;i++)out[off+i]=block[i]^prev[i];
    prev=data.subarray(off,off+16);
  }
  const p=out[out.length-1];
  if(p<1||p>16||p>out.length)throw new Error('AES 填充无效');
  for(let i=out.length-p;i<out.length;i++)if(out[i]!==p)throw new Error('AES 填充无效');
  return out.subarray(0,out.length-p);
}
function rotr(x,n){return ((x>>>n)|(x<<(32-n)))>>>0}
const SHA_K=new Uint32Array([
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256Bytes(msg){
  const H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const l=msg.length,bitLen=l*8;
  const total=(((l+9)+63)>>6)<<6;
  const data=new Uint8Array(total);data.set(msg);data[l]=0x80;
  const dv=new DataView(data.buffer);
  dv.setUint32(total-8,Math.floor(bitLen/0x100000000));
  dv.setUint32(total-4,bitLen>>>0);
  const w=new Uint32Array(64);
  for(let off=0;off<total;off+=64){
    for(let i=0;i<16;i++)w[i]=dv.getUint32(off+i*4);
    for(let i=16;i<64;i++){
      const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);
      const s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
    for(let i=0;i<64;i++){
      const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(h+S1+ch+SHA_K[i]+w[i])>>>0;
      const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj=(a&b)^(a&c)^(b&c);
      const t2=(S0+maj)>>>0;
      h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    H[0]=(H[0]+a)>>>0;H[1]=(H[1]+b)>>>0;H[2]=(H[2]+c)>>>0;H[3]=(H[3]+d)>>>0;
    H[4]=(H[4]+e)>>>0;H[5]=(H[5]+f)>>>0;H[6]=(H[6]+g)>>>0;H[7]=(H[7]+h)>>>0;
  }
  const out=new Uint8Array(32),odv=new DataView(out.buffer);
  for(let i=0;i<8;i++)odv.setUint32(i*4,H[i]);
  return out;
}
function hasWebCrypto(){try{return typeof crypto!=='undefined'&&crypto&&crypto.subtle&&typeof crypto.subtle.digest==='function'&&typeof crypto.subtle.importKey==='function'}catch(e){return false}}
async function sha256Digest(msg){if(hasWebCrypto()){try{return new Uint8Array(await crypto.subtle.digest('SHA-256',msg))}catch(e){}}return sha256Bytes(msg)}
async function aesCbcDecryptData(blob,ki){
  if(hasWebCrypto()){
    const key=await crypto.subtle.importKey('raw',ki.key,{name:'AES-CBC'},false,['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv:ki.iv},key,blob));
  }
  return aesCbcDecryptBytes(blob,ki.key,ki.iv);
}
async function keyIv(pub){let parts=[pub.lang,pub.symbol,pub.year];if(Number(pub.issue||0)!==0)parts.push(pub.issue);const digest=await sha256Digest(new TextEncoder().encode(parts.join('_')));const full=xor(digest,bytesHex(XOR));return {key:full.slice(0,16),iv:full.slice(16,32)}}
async function inflateZlib(data){
  if(window.pako&&typeof window.pako.inflate==='function')return window.pako.inflate(data);
  if(typeof DecompressionStream!=='undefined'){
    const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error('内置解压组件未能加载，请重新打开完整的单文件 HTML。');
}
async function inflateRaw(data){
  if(window.pako&&typeof window.pako.inflateRaw==='function')return window.pako.inflateRaw(data);
  if(typeof DecompressionStream!=='undefined'){
    const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error('内置 raw 解压组件未能加载，请重新打开完整的单文件 HTML。');
}
async function decryptContent(blob,ki){if(!blob||!blob.length)return '';const plain=await aesCbcDecryptData(blob,ki);const inflated=await inflateZlib(new Uint8Array(plain));return new TextDecoder('utf-8').decode(inflated)}
// Content encodings differ between publication generations. Try the standard
// AES+zlib first, then the raw-deflate and unencrypted variants documented by
// other open-source JWPUB parsers, so one odd publication cannot silently lose
// every document.
async function decryptContentAny(blob,ki){
  if(!blob||!blob.length)return {html:'',mode:'empty'};
  let plain=null,aesErr=null;
  try{
    plain=await aesCbcDecryptData(blob,ki);
  }catch(e){aesErr=e}
  const attempts=[];
  if(plain){attempts.push(['aes+zlib',()=>inflateZlib(plain)],['aes+raw',()=>inflateRaw(plain)]);}
  attempts.push(['plain+zlib',()=>inflateZlib(new Uint8Array(blob))],['plain+raw',()=>inflateRaw(new Uint8Array(blob))]);
  for(const [mode,fn] of attempts){
    try{const out=await fn();const html=new TextDecoder('utf-8',{fatal:false}).decode(out);if(html&&html.length)return {html,mode};}catch(e){}
  }
  try{const txt=new TextDecoder('utf-8',{fatal:false}).decode(new Uint8Array(blob));if(/<\s*[a-zA-Z!]/.test(txt))return {html:txt,mode:'plain-text'};}catch(e){}
  throw aesErr||new Error('无法解码内容');
}
function rows(db,table){try{const q=db.exec('SELECT * FROM "'+table.replace(/"/g,'""')+'"');if(!q.length)return [];const cols=q[0].columns;return q[0].values.map(vals=>Object.fromEntries(cols.map((c,i)=>[c,vals[i]])))}catch(e){return []}}
function pick(o,names,def=null){
  for(const n of names){if(o&&o[n]!==undefined&&o[n]!==null)return o[n]}
  if(o){const keys=Object.keys(o);for(const n of names){const k=keys.find(x=>x.toLowerCase()===String(n).toLowerCase());if(k&&o[k]!==undefined&&o[k]!==null)return o[k]}}
  return def;
}
function bytes(v){if(v instanceof Uint8Array)return v;if(v instanceof ArrayBuffer)return new Uint8Array(v);if(Array.isArray(v))return new Uint8Array(v);if(v&&typeof v==='object'){const ks=Object.keys(v);if(ks.length&&ks.every(k=>/^\d+$/.test(k))){ks.sort((a,b)=>Number(a)-Number(b));return new Uint8Array(ks.map(k=>Number(v[k])&255));}}return null}
function mime(name){const e=(name.split('.').pop()||'').toLowerCase();return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',svg:'image/svg+xml',pdf:'application/pdf',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf'})[e]||'application/octet-stream'}
function sortOrder(o,fallback=0){
  const v=pick(o,['ViewOrder','SortOrder','Ordinal','Position','Order','Sequence','DisplayOrder','SortIndex','Index'],null);
  if(v===null||v===undefined||v==='')return fallback;
  const n=Number(v);
  return Number.isFinite(n)?n:fallback;
}
function normId(v){return String(v??'').trim()}
function normMepsId(v){return String(v??'').trim().replace(/^0+(?=\d)/,'')}
function plainText(html){
  try{
    const doc=new DOMParser().parseFromString(String(html||''),'text/html');
    doc.querySelectorAll('rt,rp,script,style').forEach(n=>n.remove());
    return (doc.body?doc.body.textContent:'').replace(/[\s\u200b]+/g,' ').trim();
  }catch(e){return String(html||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
}
function resourceKey(v){return String(v||'').replace(/^jwpub-media:\/\//i,'').replace(/[?#].*$/,'').replace(/\\/g,'/').replace(/^\.\//,'').toLowerCase()}
function lookupAsset(assetMap,raw){const k=resourceKey(raw);if(!k)return null;if(assetMap[k])return assetMap[k];const base=k.split('/').pop();return assetMap['$base:'+base]||null}
function rewriteCssUrls(css,assetMap){return String(css||'').replace(/@import\s+(?:url\()?\s*["']?[^;"')]+["']?\s*\)?[^;]*;?/gi,'').replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi,(all,q,u)=>{const v=u.trim();if(!v||/^(data:|blob:|#)/i.test(v))return /^https?:|^\/\//i.test(v)?'none':'none';const mapped=lookupAsset(assetMap,v);return mapped?`url("${mapped}")`:'none';});}
function cleanHtml(raw,assetMap){
  const doc=new DOMParser().parseFromString(raw,'text/html');
  doc.querySelectorAll('script,iframe,object,embed,base,meta[http-equiv],link[rel="stylesheet"],link[rel="preload"],source[src^="http"],img[src^="http"],img[src^="//"]').forEach(n=>n.remove());
  doc.querySelectorAll('video,audio').forEach(n=>{
    const figure=doc.createElement('figure');figure.className='offline-media-placeholder';
    const poster=n.getAttribute('data-image')||n.getAttribute('poster')||'';
    if(poster){const img=doc.createElement('img');img.setAttribute('src',poster);img.setAttribute('alt','');figure.appendChild(img)}
    const caption=doc.createElement('figcaption');
    caption.textContent=n.tagName.toLowerCase()==='video'?'此内容是视频；离线单文件版本不保存视频文件。':'此内容是音频；离线单文件版本不保存音频文件。';
    figure.appendChild(caption);n.replaceWith(figure);
  });
  doc.querySelectorAll('form').forEach(f=>['action','method','target'].forEach(a=>f.removeAttribute(a)));
  doc.querySelectorAll('*').forEach(el=>{
    [...el.attributes].forEach(a=>{
      const n=a.name.toLowerCase(),v=a.value.trim();
      if(n.startsWith('on')||n==='srcdoc')el.removeAttribute(a.name);
      if((n==='href'||n==='src'||n==='xlink:href')&&/^javascript:/i.test(v))el.removeAttribute(a.name);
      if(n==='style')el.setAttribute('style',rewriteCssUrls(v,assetMap));
    });
  });
  const rewriteSrc=(el,attr)=>{const rawSrc=el.getAttribute(attr)||'';if(!rawSrc)return;const mapped=lookupAsset(assetMap,rawSrc);if(mapped)el.setAttribute(attr,mapped);else if(!/^(data:|blob:|#)/i.test(rawSrc))el.removeAttribute(attr);};
  doc.querySelectorAll('[src]').forEach(el=>rewriteSrc(el,'src'));
  doc.querySelectorAll('[srcset]').forEach(el=>{const parts=(el.getAttribute('srcset')||'').split(',').map(x=>{const m=x.trim().match(/^(\S+)(\s+.*)?$/);if(!m)return '';const u=lookupAsset(assetMap,m[1]);return u?u+(m[2]||''):''}).filter(Boolean);if(parts.length)el.setAttribute('srcset',parts.join(', '));else el.removeAttribute('srcset')});
  doc.querySelectorAll('style').forEach(st=>{st.textContent=rewriteCssUrls(st.textContent,assetMap)});
  // Keep only local fragment links, mapped packaged assets, or recognized JWPUB anchors.
  // Non-anchor SVG/use/image hrefs must never retain a remote URL.
  const linkedElements=new Set([...doc.querySelectorAll('[href]')]);doc.querySelectorAll('*').forEach(el=>{if(el.hasAttribute('xlink:href'))linkedElements.add(el)});
  [...linkedElements].forEach(el=>{
    const attr=el.hasAttribute('href')?'href':'xlink:href',h=(el.getAttribute(attr)||'').trim();
    if(el.tagName.toLowerCase()==='a'){
      if(/^jwpub:\/\//i.test(h)){el.dataset.jwlink=h;el.removeAttribute(attr);el.setAttribute('role','link');el.style.cursor='pointer';}
      // Some publications store the canonical address without the jwpub://
      // scheme (for example "p/CHS:102026003/"). Treat it as an internal link
      // instead of stripping the href.
      else if(/^\/?p\//i.test(h)){const v=h.replace(/^\/p\//i,'p/');el.dataset.jwlink='jwpub://'+v;el.removeAttribute(attr);el.setAttribute('role','link');el.style.cursor='pointer';}
      else if(/^https?:\/\//i.test(h)||/^\/\//.test(h)){el.dataset.externalLink=h;el.removeAttribute(attr);el.setAttribute('role','link');el.style.cursor='pointer';}
      else if(!h.startsWith('#'))el.removeAttribute(attr);
    }else if(h.startsWith('#')){ /* same-document SVG or footnote target */ }
    else {const mapped=lookupAsset(assetMap,h);if(mapped)el.setAttribute(attr,mapped);else el.removeAttribute(attr)}
  });
  const styles=[...doc.querySelectorAll('style')].map(s=>s.textContent).join('\n');
  const body=doc.body?doc.body.innerHTML:raw;
  return {body,styles};
}

async function allTags(){return reqP(tx('tags').getAll())}
async function saveTag(tag){return reqP(tx('tags','readwrite').put(tag))}
async function allHighlights(){return reqP(tx('highlights').getAll())}
async function saveHighlight(h){return reqP(tx('highlights','readwrite').put(h))}
async function getHighlightsForDoc(bookId,docId){return reqP(tx('highlights').index('byBookDoc').getAll([String(bookId),String(docId)]))}
async function getHighlightsForBook(bookId){return reqP(tx('highlights').index('byBook').getAll(String(bookId)))}
async function getHighlightsForNote(noteId){return reqP(tx('highlights').index('byNote').getAll(String(noteId)))}
async function deleteHighlight(id){return reqP(tx('highlights','readwrite').delete(id))}
async function deleteNoteCascade(id){
  return new Promise((res,rej)=>{
    const t=idb.transaction(['notes','highlights'],'readwrite');
    t.objectStore('notes').delete(id);
    const idx=t.objectStore('highlights').index('byNote');
    const r=idx.openCursor(IDBKeyRange.only(String(id)));
    r.onsuccess=e=>{const c=e.target.result;if(c){const h=c.value;h.noteId=null;t.objectStore('highlights').put(h);c.continue();}};
    t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('删除笔记事务被中止'));
  });
}
async function deleteTagCascade(id){
  return new Promise((res,rej)=>{
    const t=idb.transaction(['tags','notes'],'readwrite');
    t.objectStore('tags').delete(id);
    const r=t.objectStore('notes').openCursor();
    r.onsuccess=e=>{const c=e.target.result;if(c){const n=c.value;if(Array.isArray(n.tagIds)&&n.tagIds.includes(id)){n.tagIds=n.tagIds.filter(x=>x!==id);t.objectStore('notes').put(n)}c.continue();}};
    t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('删除标签事务被中止'));
  });
}
// ---- split storage (v3) ----------------------------------------------------
// The v2 design kept every decrypted document, every media Blob, the raw
// SQLite file and the Bible verse blobs in a single `books` record. That made
// catalog rendering and every chapter navigation clone the whole publication.
// v3 keeps a small metadata record and stores documents/assets separately;
// the old `books` store is retained as a lightweight compatibility mirror.
async function getBookMeta(id){return reqP(tx('bookMeta').get(id))}
async function allBooks(){
  await ensureMigrated();
  const metas=await reqP(tx('bookMeta').getAll());
  // Include any legacy record whose migration failed so the user can still
  // open it instead of it silently disappearing from the library.
  const map=new Map(metas.map(m=>[m.id,m]));
  try{const legacy=await reqP(tx('books').getAll());for(const b of legacy)if(!map.has(b.id))map.set(b.id,b)}catch(e){}
  return [...map.values()];
}
async function saveBookMeta(meta){
  if(!meta||meta.id===undefined)return;
  const t=idb.transaction(['bookMeta','books'],'readwrite');
  t.objectStore('bookMeta').put(meta);t.objectStore('books').put(meta);
  await new Promise((res,rej)=>{t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('数据库事务被中止'))});
}
async function getBookAux(id,gen){
  const a=await reqP(tx('bookAux').get(id));
  if(!a)return null;
  if(gen!==undefined&&a.gen!==undefined&&a.gen!==gen)return null;
  const {id:_id,gen:_g,...rest}=a;
  return rest;
}
// Optional original-package storage. This keeps the original SQLite and the
// inner files so a JWPUB can be rebuilt without re-parsing or re-encrypting.
// It is off by default; the setting is read in the import path.
function keepSourceEnabled(){try{const v=localStorage.getItem('offlineLibraryKeepSource');return v===null?true:v==='1'}catch(e){return true}}
function setKeepSource(on){try{localStorage.setItem('offlineLibraryKeepSource',on?'1':'0')}catch(e){}}
// Original packages live in a separate IndexedDB so the main library stays at
// DB v5 and a 1.0.0 HTML can still open it after a 2.0 alpha test.
const SOURCE_DB_NAME='OfflineJwLibrarySources',SOURCE_DB_VERSION=1;
let sourceDbPromise=null;
function openSourceDB(){
  if(sourceDbPromise)return sourceDbPromise;
  sourceDbPromise=new Promise((res,rej)=>{
    const req=indexedDB.open(SOURCE_DB_NAME,SOURCE_DB_VERSION);
    req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('sources'))d.createObjectStore('sources',{keyPath:'id'});};
    req.onsuccess=()=>{const d=req.result;d.onversionchange=()=>d.close();res(d)};
    req.onerror=()=>rej(req.error);
  });
  return sourceDbPromise;
}
async function getBookSource(id){
  const db=await openSourceDB();
  return reqP(db.transaction('sources','readonly').objectStore('sources').get(id));
}
async function saveBookSource(id,source){
  if(!id||!source)return null;
  // Store the exact file the user imported. Exporting these bytes unchanged is
  // the only way to guarantee the outer ZIP matches the original JWPUB.
  const jwpub=source.jwpub instanceof Blob?source.jwpub:(source.file instanceof Blob?source.file:(source.bytes?new Blob([source.bytes]):null));
  if(!jwpub&&!source.innerZip&&!source.db)return null;
  let rec=null;
  if(jwpub){
    rec={id,name:source.name||`${id}.jwpub`,size:Number(source.size||0)||jwpub.size,jwpub,importedAt:source.importedAt||Date.now()};
  }else{
    const manifestBytes=source.manifestBytes instanceof Blob?new Uint8Array(await source.manifestBytes.arrayBuffer()):source.manifestBytes;
    const innerZipBlob=source.innerZip instanceof Blob?source.innerZip:source.innerZip?new Blob([source.innerZip]):null;
    const dbBlob=source.db instanceof Blob?source.db:(source.dbBytes||source.db)?new Blob([source.dbBytes||source.db]):null;
    const files=(source.files||[]).map(f=>({name:f.name,blob:f.blob instanceof Blob?f.blob:new Blob([f.blob])}));
    const payloadSize=innerZipBlob?innerZipBlob.size:(dbBlob?dbBlob.size:0)+files.reduce((n,f)=>n+Number(f.blob&&f.blob.size||0),0);
    const size=Number(source.size||0)||payloadSize+Number(manifestBytes&&manifestBytes.byteLength||0);
    rec={id,name:source.name||`${id}.jwpub`,size,dbName:source.dbName||'publication.db',innerZip:innerZipBlob,manifestBytes,outerFiles:source.outerFiles||[],importedAt:source.importedAt||Date.now()};
    if(!innerZipBlob){if(dbBlob)rec.db=dbBlob;rec.files=files}
  }
  const db=await openSourceDB();
  await new Promise((res,rej)=>{
    const t=db.transaction('sources','readwrite');
    t.objectStore('sources').put(rec);
    t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('原始包保存事务被中止'));
  });
  await markBookSource(id,rec);
  return rec;
}
async function markBookSource(id,source){
  const meta=await getBookMeta(id);if(!meta)return;
  meta.hasSource=!!source;
  meta.sourceSize=Number(source&&source.size||0);
  meta.sourceName=source&&source.name||'';
  await saveBookMeta(meta);
}
async function deleteBookSource(id){
  try{
    const db=await openSourceDB();
    await new Promise((res,rej)=>{const t=db.transaction('sources','readwrite');t.objectStore('sources').delete(id);t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('原始包删除事务被中止'))});
  }catch(e){}
}
async function countBookSources(){
  try{const db=await openSourceDB();return await reqP(db.transaction('sources','readonly').objectStore('sources').count())}catch(e){return 0}
}
async function bookSourceTotalBytes(){
  try{
    const db=await openSourceDB();
    const rows=await reqP(db.transaction('sources','readonly').objectStore('sources').getAll());
    return rows.reduce((n,r)=>n+Number(r&&r.size||0),0);
  }catch(e){return 0}
}
// Experimental 2.0 read path: open the stored original JWPUB, query SQLite on
// demand and decrypt one document. Parsed data remains the fallback.
const sourceDbCache=new Map(),sourceDocCache=new Map();
const SOURCE_DB_CACHE_MAX=1,SOURCE_DOC_CACHE_MAX=8;
function sourceReadEnabled(){try{return localStorage.getItem('offlineLibrarySourceRead')==='1'}catch(e){return false}}
function setSourceRead(on){try{localStorage.setItem('offlineLibrarySourceRead',on?'1':'0')}catch(e){}}
function sourceFirstEnabled(){try{return localStorage.getItem('offlineLibrarySourceFirst')==='1'}catch(e){return false}}
function setSourceFirst(on){try{localStorage.setItem('offlineLibrarySourceFirst',on?'1':'0')}catch(e){}}
// Source-first books keep only document metadata in IndexedDB. The body is
// decrypted from the stored original package on demand and cached in memory.
async function ensureDocHtml(book,doc){
  if(!book||!doc)return '';
  if(doc.html)return doc.html;
  if(doc.bibleChapter)return '';
  if(doc.datedText){
    try{const html=await sourceDatedTextHtml(book.id,doc.datedTextId);if(html){doc.html=html;return html}}catch(e){}
    return '';
  }
  try{const html=await sourceDocHtml(book.id,doc.id);if(html){doc.html=html;return html}}catch(e){}
  return '';
}
async function stripBookDocHtml(bookId){
  const meta=await getBookMeta(bookId);if(!meta)return 0;
  let recs=[];try{recs=await reqP(tx('bookDocs').index('byBook').getAll(bookId))}catch(e){return 0}
  const t=idb.transaction('bookDocs','readwrite'),store=t.objectStore('bookDocs');
  let changed=0;
  for(const rec of recs){
    if(rec.bibleChapter||!rec.html)continue;
    const {key,bookId:_b,gen,...doc}=rec;
    store.put({key,bookId:_b,gen,...doc,html:''});
    changed++;
  }
  await new Promise((res,rej)=>{t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('清理正文事务被中止'))});
  bookLoadCache.delete(String(bookId));
  return changed;
}
function sourcePubMeta(db){
  const p=rows(db,'Publication')[0]||{};
  return {
    lang:Number(pick(p,['MepsLanguageIndex','LanguageIndex','Language'],0)),
    symbol:String(pick(p,['Symbol','PublicationSymbol'],'unknown')),
    year:Number(pick(p,['Year'],0)),
    issue:Number(pick(p,['IssueTagNumber','IssueNumber'],0))
  };
}
async function openBookSourceDb(bookId){
  const key=String(bookId);
  const cached=sourceDbCache.get(key);
  if(cached){sourceDbCache.delete(key);sourceDbCache.set(key,cached);return cached}
  const rec=await getBookSource(bookId);
  if(!rec)throw new Error('没有保存原始包');
  let innerBytes=null,manifest={},dbBytes=null;
  if(rec.jwpub){
    const outer=await JSZip.loadAsync(new Uint8Array(await rec.jwpub.arrayBuffer()));
    const contents=outer.file('contents');
    if(!contents)throw new Error('原始包缺少 contents');
    innerBytes=await contents.async('uint8array');
    const mf=outer.file('manifest.json');
    if(mf){try{manifest=JSON.parse(new TextDecoder('utf-8').decode(await mf.async('uint8array')))}catch(e){}}
  }else if(rec.innerZip){
    innerBytes=await rec.innerZip.arrayBuffer();
    if(rec.manifestBytes){try{manifest=JSON.parse(new TextDecoder('utf-8').decode(rec.manifestBytes))}catch(e){}}
  }else if(rec.db){
    dbBytes=await rec.db.arrayBuffer();
  }
  if(!dbBytes){
    if(!innerBytes)throw new Error('原始包缺少 SQLite');
    const inner=await JSZip.loadAsync(new Uint8Array(innerBytes));
    const preferred=manifest.publication&&manifest.publication.fileName;
    let dbEntry=preferred?inner.file(preferred):null;
    if(!dbEntry){for(const [name,entry] of Object.entries(inner.files)){if(!entry.dir&&/\.(db|sqlite|sqlite3)$/i.test(name)){dbEntry=entry;break}}}
    if(!dbEntry)throw new Error('原始包内没有数据库文件');
    dbBytes=await dbEntry.async('uint8array');
  }
  SQL=SQL||await initSqlJs();
  const db=new SQL.Database(dbBytes);
  const pub=sourcePubMeta(db);
  const ki=await keyIv(pub);
  const entry={db,ki,bookId:key};
  sourceDbCache.set(key,entry);
  while(sourceDbCache.size>SOURCE_DB_CACHE_MAX){
    const [oldKey,old]=sourceDbCache.entries().next().value;
    try{old.db.close()}catch(e){}
    sourceDbCache.delete(oldKey);
  }
  return entry;
}
async function sourceDocHtml(bookId,docId){
  const cacheKey=String(bookId)+':'+String(docId);
  if(sourceDocCache.has(cacheKey)){
    const v=sourceDocCache.get(cacheKey);sourceDocCache.delete(cacheKey);sourceDocCache.set(cacheKey,v);return v;
  }
  const {db,ki}=await openBookSourceDb(bookId);
  const target=normId(docId);
  const row=rows(db,'Document').find(r=>normId(pick(r,['DocumentId','Id','RowId'],''))===target);
  if(!row)return '';
  const blob=bytes(pick(row,['Content'],null));
  if(!blob)return '';
  const decoded=await decryptContentAny(blob,ki);
  sourceDocCache.set(cacheKey,decoded.html);
  while(sourceDocCache.size>SOURCE_DOC_CACHE_MAX)sourceDocCache.delete(sourceDocCache.keys().next().value);
  return decoded.html;
}
async function sourceExtractHtml(bookId,extractId){
  const id=normId(extractId);
  const cacheKey=`extract:${bookId}:${id}`;
  if(sourceDocCache.has(cacheKey)){
    const v=sourceDocCache.get(cacheKey);sourceDocCache.delete(cacheKey);sourceDocCache.set(cacheKey,v);return v;
  }
  const {db,ki}=await openBookSourceDb(bookId);
  const row=rows(db,'Extract').find(r=>normId(pick(r,['ExtractId','Id'],''))===id);
  if(!row)return '';
  const blob=bytes(pick(row,['Content'],null));
  if(!blob)return '';
  const html=(await decryptContentAny(blob,ki)).html;
  sourceDocCache.set(cacheKey,html);
  while(sourceDocCache.size>SOURCE_DOC_CACHE_MAX)sourceDocCache.delete(sourceDocCache.keys().next().value);
  return html;
}
async function sourceDatedTextHtml(bookId,datedTextId){
  const id=normId(datedTextId);
  const cacheKey=`dated:${bookId}:${id}`;
  if(sourceDocCache.has(cacheKey)){
    const v=sourceDocCache.get(cacheKey);sourceDocCache.delete(cacheKey);sourceDocCache.set(cacheKey,v);return v;
  }
  const {db,ki}=await openBookSourceDb(bookId);
  const row=rows(db,'DatedText').find(r=>normId(pick(r,['DatedTextId','Id'],''))===id);
  if(!row)return '';
  const blob=bytes(pick(row,['Content'],null));
  if(!blob)return '';
  const html=(await decryptContentAny(blob,ki)).html;
  sourceDocCache.set(cacheKey,html);
  while(sourceDocCache.size>SOURCE_DOC_CACHE_MAX)sourceDocCache.delete(sourceDocCache.keys().next().value);
  return html;
}
async function sourceCommentaryHtml(bookId,commentary){
  const id=normId(commentary&&commentary.id);
  const kind=commentary&&commentary.kind==='verse'?'verse':'paragraph';
  const cacheKey=`commentary:${bookId}:${kind}:${id}`;
  if(sourceDocCache.has(cacheKey)){
    const v=sourceDocCache.get(cacheKey);sourceDocCache.delete(cacheKey);sourceDocCache.set(cacheKey,v);return v;
  }
  const {db,ki}=await openBookSourceDb(bookId);
  const table=kind==='verse'?'VerseCommentary':'ParagraphCommentary';
  const idNames=kind==='verse'?['VerseCommentaryId','Id']:['ParagraphCommentaryId','Id'];
  const row=rows(db,table).find(r=>normId(pick(r,idNames,''))===id);
  if(!row)return '';
  const blob=bytes(pick(row,['Content'],null));
  if(!blob)return '';
  const html=(await decryptContentAny(blob,ki)).html;
  sourceDocCache.set(cacheKey,html);
  while(sourceDocCache.size>SOURCE_DOC_CACHE_MAX)sourceDocCache.delete(sourceDocCache.keys().next().value);
  return html;
}
async function stripBookAuxHtml(bookId){
  const aux=await reqP(tx('bookAux').get(bookId));if(!aux)return 0;
  let changed=0;
  for(const e of aux.extracts||[]){if(e.html){e.html='';changed++}}
  for(const c of aux.commentaries||[]){if(c.html){c.html='';changed++}}
  for(const d of aux.datedTexts||[]){if(d.html){d.html='';changed++}}
  if(changed)await reqP(tx('bookAux','readwrite').put(aux));
  bookLoadCache.delete(String(bookId));
  return changed;
}
async function stripBibleContent(bookId){
  const aux=await reqP(tx('bookAux').get(bookId));if(!aux||!aux.bibleData)return 0;
  const data=aux.bibleData;
  let changed=0;
  for(const v of data.verseRows||[]){if(v.content){v.content=null;changed++}}
  for(const c of data.chapterRows||[]){if(c.content){c.content=null;changed++}}
  if(data.keyHex){data.keyHex='';changed++}
  if(data.ivHex){data.ivHex='';changed++}
  if(changed)await reqP(tx('bookAux','readwrite').put(aux));
  bookLoadCache.delete(String(bookId));
  return changed;
}
async function stripAllSourceBooks(){
  const metas=await allBooks();let books=0,docs=0,aux=0,bible=0;
  for(const m of metas){
    if(!m.hasSource)continue;
    books++;
    docs+=await stripBookDocHtml(m.id);
    aux+=await stripBookAuxHtml(m.id);
    bible+=await stripBibleContent(m.id);
  }
  closeSourceDbs();
  return {books,docs,aux,bible};
}
async function sourceBibleRangeHtml(bookId,first,last){
  const {db,ki}=await openBookSourceDb(bookId);
  let verses=[],stmt=null;
  try{
    stmt=db.prepare('SELECT * FROM "BibleVerse" WHERE "BibleVerseId" BETWEEN ? AND ? ORDER BY "BibleVerseId"');
    stmt.bind([Number(first),Number(last)]);
    while(stmt.step())verses.push(stmt.getAsObject());
  }catch(e){
    verses=rows(db,'BibleVerse').filter(v=>{const id=Number(pick(v,['BibleVerseId','Id'],0));return id>=Number(first)&&id<=Number(last)});
  }finally{try{stmt&&stmt.free()}catch(e){}}

  let html='';
  for(const v of verses){
    const id=Number(pick(v,['BibleVerseId','Id'],0));
    const blob=bytes(pick(v,['Content'],null));if(!blob)continue;
    try{
      const text=(await decryptContentAny(blob,ki)).html;
      const label=String(pick(v,['Label'],'')).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
      html+=`<div class="bible-verse" data-bible-verse="${id}"><sup>${safeText(label)}</sup> ${text}</div>`;
    }catch(e){}
  }
  return html;
}
async function sourceBibleChapterHtml(bookId,bookNum,chapter){
  const cacheKey=`bible:${bookId}:${bookNum}:${chapter}`;
  if(sourceDocCache.has(cacheKey)){
    const v=sourceDocCache.get(cacheKey);sourceDocCache.delete(cacheKey);sourceDocCache.set(cacheKey,v);return v;
  }
  const {db,ki}=await openBookSourceDb(bookId);
  const chapterRow=rows(db,'BibleChapter').find(r=>Number(pick(r,['BookNumber'],0))===Number(bookNum)&&Number(pick(r,['ChapterNumber'],0))===Number(chapter));
  let html='';
  if(chapterRow){
    const blob=bytes(pick(chapterRow,['Content'],null));
    if(blob){try{html=(await decryptContentAny(blob,ki)).html}catch(e){}}
    if(!html){
      const first=Number(pick(chapterRow,['FirstVerseId'],0)),last=Number(pick(chapterRow,['LastVerseId'],0));
      if(first&&last){
        for(const v of rows(db,'BibleVerse')){
          const id=Number(pick(v,['BibleVerseId','Id'],0));
          if(id<first||id>last)continue;
          const vb=bytes(pick(v,['Content'],null));if(!vb)continue;
          try{
            const text=(await decryptContentAny(vb,ki)).html;
            const label=String(pick(v,['Label'],'')).replace(/<[^>]+>/g,' ').trim();
            html+=`<div class="bible-verse" data-bible-verse="${id}"><sup>${safeText(label)}</sup> ${text}</div>`;
          }catch(e){}
        }
      }
    }
  }
  sourceDocCache.set(cacheKey,html);
  while(sourceDocCache.size>SOURCE_DOC_CACHE_MAX)sourceDocCache.delete(sourceDocCache.keys().next().value);
  return html;
}
function closeSourceDbs(){
  for(const e of sourceDbCache.values()){try{e.db.close()}catch(err){}}
  sourceDbCache.clear();sourceDocCache.clear();
}

function dailyDateKey(offset,year){
  const n=Number(offset);
  if(!Number.isFinite(n))return 0;
  if(n>19000101)return n;
  const d=new Date(Date.UTC(Number(year)||new Date().getFullYear(),0,1));
  d.setUTCDate(d.getUTCDate()+n);
  return d.getUTCFullYear()*10000+(d.getUTCMonth()+1)*100+d.getUTCDate();
}
function dailyDateLabel(key){
  const s=String(key||'');
  return /^\d{8}$/.test(s)?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`:'';
}
function dailyMonthLabel(key){
  const s=String(key||'');
  return /^\d{8}$/.test(s)?`${s.slice(0,4)}-${s.slice(4,6)}`:'';
}
function normalizeDailyBook(book){
  if(!book||!Array.isArray(book.dailyDocs)||!book.dailyDocs.length)return book;
  const year=Number(book.year)||new Date().getFullYear();
  const dated=[];
  for(const d of book.docs||[]){
    if(!d.datedText)continue;
    const key=dailyDateKey(d.dateOffset,year);
    if(!key)continue;
    d.dateKey=key;
    d.title=dailyDateLabel(key)||d.title;
    dated.push(d);
  }
  for(const dd of book.dailyDocs){
    const key=dailyDateKey(dd.dateOffset,year);
    if(key){dd.dateKey=key;dd.title=dailyDateLabel(key)||dd.title}
  }
  const toc=Array.isArray(book.toc)?book.toc.filter(t=>!t.datedText&&!String(t.nodeId||'').startsWith('dated-')&&!String(t.docId||'').startsWith('dated-')):[];
  if(toc.some(t=>t.docId!==null&&t.docId!==undefined)){
    book.toc=toc;
    return book;
  }
  const months=new Map();
  for(const d of dated){
    const month=Math.floor(d.dateKey/100);
    if(!months.has(month))months.set(month,d);
  }
  book.toc=[...months.entries()].sort((a,b)=>a[0]-b[0]).map(([month,d])=>({nodeId:`dated-month-${month}`,parentId:'-1',docId:d.id,title:dailyMonthLabel(d.dateKey),depth:0,group:false,datedMonth:true}));
  return book;
}
function buildBookMeta(book,gen,docs,assets){
  const {docs:_d,assets:_a,rawDatabase:_r,bibleData:_b,extracts:_e,commentaries:_c,datedTexts:_dt,...rest}=book;
  let estimatedSize=0;
  if(docs)for(const d of docs)estimatedSize+=String(d.html||'').length*2;
  if(assets)for(const a of assets)estimatedSize+=Number(a.blob&&a.blob.size||0);
  if(book.bibleData&&Array.isArray(book.bibleData.verseRows))for(const v of book.bibleData.verseRows)estimatedSize+=Number(v.content&&(v.content.byteLength||v.content.length)||0);
  if(book.bibleData&&Array.isArray(book.bibleData.chapterRows))for(const c of book.bibleData.chapterRows)estimatedSize+=Number(c.content&&(c.content.byteLength||c.content.length)||0);
  const dailyDocs=isDailyTextPublication(book)?(docs||[]).filter(d=>d&&d.datedText).map(d=>({id:d.id,title:d.title,dateOffset:Number(d.dateOffset),lastDateOffset:Number(d.lastDateOffset??d.dateOffset),datedText:true})):[];
  const extractLinks=(book.extracts||[]).map(e=>({id:e.id,link:e.link||'',sourceLink:e.sourceLink||'',sourceDocId:Number(e.sourceDocId||0),refSymbol:e.refSymbol||'',refEnglishSymbol:e.refEnglishSymbol||'',refDocId:Number(e.refDocId||0),refBegin:Number(e.refBegin||0),refEnd:Number(e.refEnd||0),refPublicationId:Number(e.refPublicationId||0),refIssue:Number(e.refIssue||0),refUndated:e.refUndated||'',refTitle:e.refTitle||'',beginPid:Number(e.beginPid||0),endPid:Number(e.endPid||0),caption:e.caption||''}));
  const commentaryIds=(book.commentaries||[]).map(c=>c.id);
  const extractsMissingHtml=(book.extracts||[]).filter(e=>!e.html).length;
  const bibleVersions=book.bibleData&&Array.isArray(book.bibleData.versionCodes)?book.bibleData.versionCodes:[];
  return {...rest,id:book.id,gen,docCount:docs?docs.length:Number(rest.docCount||0),assetCount:assets?assets.length:Number(rest.assetCount||0),estimatedSize,dailyDocs,extractLinks,commentaryIds,hasBible:!!book.bibleData||!!rest.hasBible,hasExtracts:!!(book.extracts&&book.extracts.length)||!!rest.hasExtracts,extractsMissingHtml,hasCommentaries:!!(book.commentaries&&book.commentaries.length)||!!rest.hasCommentaries,hasDatedText:!!(dailyDocs.length)||!!rest.hasDatedText,bibleVersions};
}
async function persistBook(book){
  if(!book||book.id===undefined)throw new Error('保存失败：缺少出版物 ID');
  const id=book.id;
  if(book.rawDatabase&&Array.isArray(book.extracts)&&book.extracts.some(e=>!e.html))book=await enrichLegacyExtracts(book);
  const gen=book.gen||book.importedAt||Date.now();
  const docs=Array.isArray(book.docs)?book.docs:null;
  const assets=Array.isArray(book.assets)?book.assets:null;
  const hasAux=('bibleData'in book)||('extracts'in book)||('commentaries'in book)||('datedTexts'in book);
  const aux={id,gen,bibleData:book.bibleData??null,extracts:Array.isArray(book.extracts)?book.extracts:[],commentaries:Array.isArray(book.commentaries)?book.commentaries:[],datedTexts:Array.isArray(book.datedTexts)?book.datedTexts:[]};
  const meta=buildBookMeta(book,gen,docs,assets);
  // Re-importing a publication must not silently reset the user's manual
  // category, favorite flag or usage counters.
  let previous=null;try{previous=await getBookMeta(id)}catch(e){}
  if(previous){
    if(previous.categorySource==='manual'||previous.categorySource==='legacy'||previous.categoryId){
      meta.categoryId=previous.categoryId||meta.categoryId;
      meta.categoryPath=previous.categoryPath||meta.categoryPath;
      meta.categorySource=previous.categorySource||'legacy';
    }
    if(meta.favorite===undefined&&previous.favorite!==undefined)meta.favorite=previous.favorite;
    if(meta.usageCount===undefined&&previous.usageCount!==undefined)meta.usageCount=previous.usageCount;
    if(meta.lastOpenedAt===undefined&&previous.lastOpenedAt!==undefined)meta.lastOpenedAt=previous.lastOpenedAt;
  }
  const stores=['books','bookMeta'];
  if(docs)stores.push('bookDocs');
  if(assets)stores.push('bookAssets');
  if(hasAux)stores.push('bookAux');
  const t=idb.transaction(stores,'readwrite');
  t.objectStore('bookMeta').put(meta);
  t.objectStore('books').put(meta);
  if(docs)docs.forEach((d,ord)=>{const docId=String(d.id);t.objectStore('bookDocs').put({key:`${id}:${gen}:${docId}`,bookId:id,gen,docId,mepsId:Number(d.mepsId||0),ord,...d});});
  if(assets)for(const a of assets){const name=String(a.name);t.objectStore('bookAssets').put({key:`${id}:${gen}:${name}`,bookId:id,gen,name,blob:a.blob});}
  if(hasAux)t.objectStore('bookAux').put(aux);
  await new Promise((res,rej)=>{t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('存储空间不足或数据库事务被中止'))});
  bookLoadCache.delete(String(id));
  try{await purgeOldGenerations(id,gen)}catch(e){console.warn('清理旧版本记录失败',e)}
  return meta;
}
async function saveBook(b){if(Array.isArray(b.docs)||Array.isArray(b.assets))return persistBook(b);return saveBookMeta({...b})}
async function loadBook(id,opts={}){
  const cacheKey=String(id);
  if(!opts.assets){
    const cached=bookLoadCache.get(cacheKey);
    if(cached){bookLoadCache.delete(cacheKey);bookLoadCache.set(cacheKey,cached);return cached.book}
  }
  const metaRow=await getBookMeta(id);
  const legacy=await reqP(tx('books').get(id));
  const meta=metaRow||legacy;
  if(!meta)return null;
  // A legacy record that has not been migrated yet still carries its own
  // documents and media; use it as-is instead of returning an empty book.
  if(!metaRow&&legacy&&(Array.isArray(legacy.docs)||Array.isArray(legacy.assets)))return legacy;
  const gen=meta.gen;
  const docsRaw=await reqP(tx('bookDocs').index('byBook').getAll(id));
  const docs=docsRaw.filter(d=>gen===undefined||d.gen===undefined||d.gen===gen)
    .sort((a,b)=>{const av=a.ord!==undefined?a.ord:Number(a.id),bv=b.ord!==undefined?b.ord:Number(b.id);return (Number.isFinite(av)?av:0)-(Number.isFinite(bv)?bv:0)})
    .map(({key,bookId,gen,ord,...d})=>d);
  let assets=[];
  if(opts.assets){
    const assetsRaw=await reqP(tx('bookAssets').index('byBook').getAll(id));
    assets=assetsRaw.filter(a=>gen===undefined||a.gen===undefined||a.gen===gen).map(a=>({name:a.name,blob:a.blob}));
  }
  const aux=await getBookAux(id,gen)||{};
  const book=normalizeDailyBook({...meta,docs,assets,...aux});
  // Cache ordinary publications. Bible aux data can be very large, so Bibles
  // are only reused while they are the current book.
  if(!opts.assets&&!book.hasBible&&!book.bibleData){
    bookLoadCache.set(cacheKey,{gen:book.gen,book});
    while(bookLoadCache.size>BOOK_LOAD_CACHE_MAX)bookLoadCache.delete(bookLoadCache.keys().next().value);
  }
  return book;
}
// Collect packaged media names referenced by a document, an extract or a
// popover. Loading only these keeps a 100MB Bible from materialising every
// image when one chapter is opened.
function assetNamesInHtml(html){
  const set=new Set();
  const text=String(html||'');
  const re=/jwpub-media:\/\/([^"\'\s)<>]+)/gi;
  let m;
  while((m=re.exec(text))){ if(m[1])set.add(m[1]); }
  text.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi,(all,q,u)=>{
    const v=String(u||'').trim();
    if(v&&!/^(data:|blob:|https?:|\/\/|#)/i.test(v))set.add(v.replace(/^jwpub-media:\/\//i,''));
    return all;
  });
  return [...set];
}
async function extractsFromDb(db,ki){
  const extractRows=rows(db,'Extract'),deRows=rows(db,'DocumentExtract');
  const join=new Map();
  for(const de of deRows){const id=String(pick(de,['ExtractId','Id'],''));if(!join.has(id))join.set(id,[]);join.get(id).push(de)}
  const out=[];
  for(const er of extractRows){
    const id=String(pick(er,['ExtractId','Id'],''));
    const blob=bytes(pick(er,['Content','Html','HTML','Data'],null));
    let html='';
    if(blob){try{html=(await decryptContentAny(blob,ki)).html}catch(e){continue}}
    if(!html)continue;
    const related=join.get(id)||[null];
    for(const de of related){
      const meta={...(er||{}),...(de||{})};
      const rawLink=String(pick(meta,['Link','Href','URL'],pick(er,['Link','Href','URL'],''))||'').trim();
      const refDocId=Number(pick(meta,['RefMepsDocumentId','RefDocID','ReferencedDocumentId'],pick(er,['RefMepsDocumentId','RefDocID'],0))||0);
      const refSymbol=String(pick(meta,['RefSymbol','PublicationSymbol'],pick(er,['RefSymbol'],''))||'').trim();
      const refBegin=Number(pick(meta,['RefBeginParagraphOrdinal','RefBegin','BeginParagraph','FirstParagraph'],pick(er,['RefBeginParagraphOrdinal','RefBegin'],0))||0);
      const refEnd=Number(pick(meta,['RefEndParagraphOrdinal','RefEnd','EndParagraph','LastParagraph'],pick(er,['RefEndParagraphOrdinal','RefEnd'],refBegin))||refBegin);
      const refPublicationId=Number(pick(meta,['RefPublicationId'],pick(er,['RefPublicationId'],0))||0);
      let link=rawLink;
      if(/^p\//i.test(link))link='jwpub://'+link; else if(/^\/p\//i.test(link))link='jwpub:/'+link;
      const caption=String(pick(meta,['Caption','CaptionRich','Title','Label'],pick(er,['Caption','CaptionRich','Title','Label'],''))||'');
      const captionText=caption.replace(/<[^>]+>/g,' ').replace(/[\s\u200b]+/g,' ').trim();
      out.push({id:`${id}:${String(pick(de||{},['DocumentId','DocId'],''))}`,extractId:id,sourceDocId:Number(pick(de||{},['DocumentId','DocId'],0)),link,html,caption,captionText,refDocId,refSymbol,refBegin,refEnd,refPublicationId,refClass:Number(pick(meta,['RefMepsDocumentClass','RefClass'],pick(er,['RefMepsDocumentClass','RefClass'],0))||0),refUndated:String(pick(meta,['RefUndated'],pick(er,['RefUndated'],''))||''),refIssue:Number(pick(meta,['RefIssue'],pick(er,['RefIssue'],0))||0),beginPid:Number(pick(meta,['BeginPID','BeginParagraphNumber','ParagraphNumber'],0)),sort:Number(pick(meta,['Sort','SortOrder','ViewOrder'],0))});
    }
  }
  return out;
}
// v0.5.1 and earlier kept only extract metadata when a JWPUB was imported;
// the decrypted Extract.Content was not stored. If the legacy record still
// carries its raw SQLite database, rebuild the extract bodies from it.
async function enrichLegacyExtracts(book){
  if(!book||!book.rawDatabase)return book;
  try{
    const ki=await keyIv(book);
    SQL=SQL||await initSqlJs();
    const raw=bytes(book.rawDatabase)||book.rawDatabase;
    const db=new SQL.Database(raw);
    try{
      const extracts=await extractsFromDb(db,ki);
      if(extracts.length)return {...book,extracts};
    }finally{try{db.close()}catch(e){}}
  }catch(e){logDiag('warn','补全旧版相关文章失败',{id:book.id,message:e&&e.message||String(e)})}
  return book;
}
async function loadAssetsForHtml(bookId,gen,html){
  const names=assetNamesInHtml(html);
  const out=[];
  for(const name of names){
    let rec=null;
    try{rec=await reqP(tx('bookAssets').get(`${bookId}:${gen}:${name}`))}catch(e){}
    if(!rec){try{rec=await reqP(tx('bookAssets').get(`${bookId}:${gen}:${name.toLowerCase()}`))}catch(e){}}
    if(rec)out.push({name:rec.name,blob:rec.blob});
  }
  return out;
}
async function loadBookAuxOnly(id){
  const meta=await getBookMeta(id)||await reqP(tx('books').get(id));
  if(!meta)return null;
  const aux=await getBookAux(id,meta.gen)||{};
  return {...meta,...aux};
}
async function findDocsByMeps(mepsId){return reqP(tx('bookDocs').index('byMeps').getAll(Number(mepsId)))}
async function getBookDoc(bookId,docId){
  const meta=await getBookMeta(bookId);
  if(!meta)return null;
  try{const rec=await reqP(tx('bookDocs').get(`${bookId}:${meta.gen}:${String(docId)}`));if(rec){const {key,bookId:_b,gen,...doc}=rec;return doc;}}catch(e){}
  try{const all=await reqP(tx('bookDocs').index('byBook').getAll(bookId));const rec=all.find(d=>String(d.docId)===String(docId));if(rec){const {key,bookId:_b,gen,...doc}=rec;return doc;}}catch(e){}
  return null;
}

async function touchedBookMeta(book,patch){
  if(!book||book.id===undefined)return;
  const meta=await getBookMeta(book.id);
  if(!meta)return;
  Object.assign(meta,patch||{});Object.assign(book,patch||{});
  await saveBookMeta(meta);
}
function deleteBookData(bookId){
  bookLoadCache.delete(String(bookId));
  return new Promise((res,rej)=>{
    const t=idb.transaction(['bookDocs','bookAssets'],'readwrite');
    const del=name=>{const idx=t.objectStore(name).index('byBook');const r=idx.openKeyCursor(IDBKeyRange.only(bookId));r.onsuccess=e=>{const c=e.target.result;if(c){t.objectStore(name).delete(c.primaryKey);c.continue();}};};
    del('bookDocs');del('bookAssets');
    t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('删除事务被中止'));
  });
}
// Re-importing a publication creates a new generation. Remove older document
// and asset generations only after the new transaction has committed.
function purgeOldGenerations(bookId,keepGen){
  return new Promise((res,rej)=>{
    const t=idb.transaction(['bookDocs','bookAssets'],'readwrite');
    const purge=name=>{const idx=t.objectStore(name).index('byBook');const r=idx.openCursor(IDBKeyRange.only(bookId));r.onsuccess=e=>{const c=e.target.result;if(c){if(c.value&&c.value.gen!==keepGen)t.objectStore(name).delete(c.primaryKey);c.continue();}};};
    purge('bookDocs');purge('bookAssets');
    t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('清理旧版本事务被中止'));
  });
}
// Migrate v2 records lazily and once. Each book is moved in its own transaction;
// the legacy `books` record is replaced by a lightweight metadata mirror, so a
// failure leaves the original record intact.
let migrationPromise=null;
function ensureMigrated(){if(!migrationPromise)migrationPromise=migrateLegacyBooks().then(()=>ensureStableIds()).then(()=>ensureCanonicalAnchors()).catch(e=>{migrationPromise=null;throw e});return migrationPromise}
async function migrateLegacyBooks(){
  let flag=null;try{flag=await reqP(tx('system').get('migratedV3'))}catch(e){}
  if(flag&&flag.done)return;
  let keys=[];try{keys=await reqP(tx('books').getAllKeys())}catch(e){keys=[]}
  if(keys.length)say(t('正在升级本地数据'),`正在把 ${keys.length} 份已导入出版物拆分为更省内存的存储结构，请勿关闭页面…`);
  const failed=[];
  for(const key of keys){
    let rec=null;try{rec=await reqP(tx('books').get(key))}catch(e){failed.push({id:key,error:String(e&&e.message||e)});continue}
    if(!rec)continue;
    const id=rec.id===undefined?key:rec.id;
    const heavy=Array.isArray(rec.docs)||Array.isArray(rec.assets)||!!rec.rawDatabase||!!rec.bibleData||Array.isArray(rec.extracts)||Array.isArray(rec.commentaries)||Array.isArray(rec.datedTexts);
    try{
      if(heavy){await persistBook({...rec,id});}
      else{const meta=await getBookMeta(id);if(!meta)await saveBookMeta({...rec,id,gen:rec.gen||Date.now(),docCount:Number(rec.docCount||0)});}
    }catch(e){failed.push({id,error:String(e&&e.message||e)});console.warn('升级出版物失败',id,e);}
  }
  await reqP(tx('system','readwrite').put({id:'migratedV3',done:true,at:Date.now(),failed}));
  if(keys.length){
    if(failed.length)say(t('部分数据未升级'),`有 ${failed.length} 份出版物未能拆分存储，仍保留旧格式并可继续打开；其余 ${keys.length-failed.length} 份已完成。\n\n${failed.slice(0,5).map(f=>f.id+'：'+f.error).join('\n')}`);
    else try{$('modal').style.display='none'}catch(e){}
  }
}
// One-time migration from the old lang_symbol_year_issue key to the stable
// lang_keySymbol_issue key. Only records whose id still matches the old
// formula are touched, so custom/legacy test records keep their ids.
async function ensureStableIds(){
  let flag=null;try{flag=await reqP(tx('system').get('migratedStableIds'))}catch(e){}
  if(flag&&flag.done)return;
  const metas=[];
  try{for(const m of await reqP(tx('bookMeta').getAll()))metas.push(m)}catch(e){}
  try{
    const seen=new Set(metas.map(m=>String(m.id)));
    for(const b of await reqP(tx('books').getAll()))if(!seen.has(String(b.id))){metas.push(b);seen.add(String(b.id))}
  }catch(e){}
  const targets=new Set(metas.map(m=>String(m.id)));
  // If several old editions collapse to the same stable id, keep the newest
  // one and merge older notes into it instead of accidentally keeping an old
  // year because of key ordering.
  metas.sort((a,b)=>{
    const aNew=String(a.id)===idFor(a),bNew=String(b.id)===idFor(b);
    if(aNew!==bNew)return aNew?-1:1;
    const ay=Number(a.year||0),by=Number(b.year||0);
    if(ay!==by)return by-ay;
    return Number(b.importedAt||b.gen||0)-Number(a.importedAt||a.gen||0);
  });
  let notes=[],highlights=[],marks=[],history=[];
  try{notes=await reqP(tx('notes').getAll())}catch(e){}
  try{highlights=await reqP(tx('highlights').getAll())}catch(e){}
  try{marks=await reqP(tx('bookmarks').getAll())}catch(e){}
  try{history=await reqP(tx('history').getAll())}catch(e){}
  const remapId=(id,oldId,newId)=>{const s=String(id);if(s.startsWith('answer:'+oldId+':'))return 'answer:'+newId+s.slice(('answer:'+oldId).length);if(s.startsWith(oldId+':'))return newId+s.slice(oldId.length);return s};
  let migrated=0;const failed=[];
  for(const meta of metas){
    if(!shouldMigrateId(meta))continue;
    // Leave unsplit legacy records alone; they are still readable through the
    // legacy loadBook path. Splitting them first would risk losing data.
    if(Array.isArray(meta.docs)||Array.isArray(meta.assets)||meta.rawDatabase){
      failed.push({id:String(meta.id),error:'旧格式尚未拆分，已跳过 ID 迁移'});continue;
    }
    const oldId=String(meta.id),newId=idFor(meta);
    try{
      const targetExists=targets.has(newId);
      const docs=await reqP(tx('bookDocs').index('byBook').getAll(oldId));
      const assets=await reqP(tx('bookAssets').index('byBook').getAll(oldId));
      let aux=null;try{aux=await reqP(tx('bookAux').get(oldId))}catch(e){}
      const stores=['books','bookMeta','bookDocs','bookAssets','bookAux','notes','highlights','bookmarks','history'];
      const t=idb.transaction(stores,'readwrite');
      if(!targetExists){
        const moved={...meta,id:newId};
        t.objectStore('bookMeta').put(moved);t.objectStore('books').put(moved);
      }
      t.objectStore('bookMeta').delete(oldId);t.objectStore('books').delete(oldId);
      for(const d of docs){
        if(d.key!==undefined)t.objectStore('bookDocs').delete(d.key);
        if(!targetExists){
          const gen=d.gen!==undefined?d.gen:(meta.gen||'');
          t.objectStore('bookDocs').put({...d,key:`${newId}:${gen}:${d.docId}`,bookId:newId});
        }
      }
      for(const a of assets){
        if(a.key!==undefined)t.objectStore('bookAssets').delete(a.key);
        if(!targetExists){
          const gen=a.gen!==undefined?a.gen:(meta.gen||'');
          t.objectStore('bookAssets').put({...a,key:`${newId}:${gen}:${a.name}`,bookId:newId});
        }
      }
      if(aux){
        if(!targetExists)t.objectStore('bookAux').put({...aux,id:newId});
        t.objectStore('bookAux').delete(oldId);
      }
      const noteIdMap=new Map();
      for(const n of notes){
        if(String(n.bookId)!==oldId)continue;
        const nid=remapId(n.id,oldId,newId);
        if(nid!==String(n.id)){noteIdMap.set(String(n.id),nid);t.objectStore('notes').delete(n.id)}
        t.objectStore('notes').put({...n,id:nid,bookId:newId});
      }
      for(const h of highlights){
        if(String(h.bookId)!==oldId)continue;
        const patch={...h,bookId:newId};
        if(patch.noteId&&noteIdMap.has(String(patch.noteId)))patch.noteId=noteIdMap.get(String(patch.noteId));
        t.objectStore('highlights').put(patch);
      }
      for(const m of marks){
        if(String(m.bookId)!==oldId)continue;
        const mid=remapId(m.id,oldId,newId);
        if(mid!==String(m.id))t.objectStore('bookmarks').delete(m.id);
        t.objectStore('bookmarks').put({...m,id:mid,bookId:newId});
      }
      for(const h of history){
        if(String(h.bookId)!==oldId)continue;
        const hid=remapId(h.id,oldId,newId);
        if(hid!==String(h.id))t.objectStore('history').delete(h.id);
        t.objectStore('history').put({...h,id:hid,bookId:newId});
      }
      await new Promise((res,rej)=>{t.oncomplete=res;t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('稳定 ID 迁移事务被中止'))});
      targets.delete(oldId);targets.add(newId);migrated++;
    }catch(e){failed.push({id:oldId,error:String(e&&e.message||e)});console.warn('稳定 ID 迁移失败',oldId,e)}
  }
  try{await reqP(tx('system','readwrite').put({id:'migratedStableIds',done:true,at:Date.now(),migrated,failed}))}catch(e){}
  if(migrated||failed.length)logDiag(failed.length?'warn':'info','出版物 ID 已稳定化',{migrated,failed});
}
// Give existing notes/highlights a language-neutral anchor so the same
// paragraph can be found in a sibling-language edition.
async function ensureCanonicalAnchors(){
  let flag=null;try{flag=await reqP(tx('system').get('canonicalAnchorsV1'))}catch(e){}
  if(flag&&flag.done)return;
  let metas=[];try{metas=await reqP(tx('bookMeta').getAll())}catch(e){}
  const metaMap=new Map(metas.map(m=>[String(m.id),m]));
  let notes=[],highlights=[];try{notes=await reqP(tx('notes').getAll())}catch(e){}try{highlights=await reqP(tx('highlights').getAll())}catch(e){}
  const docCache=new Map();
  const docFor=async(bookId,docId)=>{
    const key=String(bookId)+':'+String(docId);
    if(docCache.has(key))return docCache.get(key);
    let d=null;try{d=await getBookDoc(bookId,docId)}catch(e){}
    docCache.set(key,d);return d;
  };
  const highlightByNote=new Map();for(const h of highlights)if(h.noteId)highlightByNote.set(String(h.noteId),h);
  let changed=0;
  for(const h of highlights){
    const meta=metaMap.get(String(h.bookId));if(!meta)continue;
    let dirty=false;
    if(!h.seriesKey){h.seriesKey=seriesKeyFor(meta);dirty=true}
    if(!h.mepsDocId&&h.docId!==undefined){const d=await docFor(h.bookId,h.docId);if(d&&d.mepsId){h.mepsDocId=String(d.mepsId);dirty=true}}
    if(dirty){try{await saveOne('highlights',h);changed++}catch(e){}}
  }
  for(const n of notes){
    const meta=metaMap.get(String(n.bookId));if(!meta)continue;
    let dirty=false;
    if(!n.seriesKey){n.seriesKey=seriesKeyFor(meta);dirty=true}
    if(!n.mepsDocId&&n.docId!==undefined){const d=await docFor(n.bookId,n.docId);if(d&&d.mepsId){n.mepsDocId=String(d.mepsId);dirty=true}}
    const h=highlightByNote.get(String(n.id))||(n.highlightId?highlights.find(x=>String(x.id)===String(n.highlightId)):null);
    if(!n.pid&&h&&h.pid){n.pid=String(h.pid);dirty=true}
    if(dirty){try{await saveOne('notes',n);changed++}catch(e){}}
  }
  try{await reqP(tx('system','readwrite').put({id:'canonicalAnchorsV1',done:true,at:Date.now(),changed}))}catch(e){}
  if(changed)logDiag('info','笔记/划线已补充跨语言定位',{changed});
}
async function countStore(name){try{return await reqP(tx(name).count())}catch(e){return -1}}
async function buildDiagnostics(){
  const metas=await allBooks();
  let storage=null,persisted=null;
  try{storage=await navigator.storage.estimate()}catch(e){}
  try{persisted=await navigator.storage.persisted()}catch(e){}
  const counts={};
  for(const s of ['books','bookMeta','bookDocs','bookAssets','bookAux','notes','tags','highlights','bookmarks','history','categories'])counts[s]=await countStore(s);
  counts.bookSources=await countBookSources();
  let migration=null;try{migration=await getOne('system','migratedV3')}catch(e){}
  return {
    appVersion:APP_VERSION,
    dbName:DB_NAME,
    dbVersion:DB_VERSION,
    generatedAt:new Date().toISOString(),
    userAgent:(typeof navigator!=='undefined'&&navigator.userAgent)||'',
    storage:storage?{usage:storage.usage,quota:storage.quota,persisted}:null,
    counts,
    migration:migration||null,
    books:metas.map(m=>({
      id:m.id,title:m.displayTitle||m.title||'',lang:m.lang,symbol:m.symbol,year:m.year,issue:m.issue,
      category:Array.isArray(m.categoryPath)?m.categoryPath.join(' / '):'',
      docCount:m.docCount,assetCount:m.assetCount,estimatedSize:m.estimatedSize,gen:m.gen||null,
      hasBible:!!m.hasBible,hasExtracts:!!m.hasExtracts,extractsMissingHtml:Number(m.extractsMissingHtml||0),hasCommentaries:!!m.hasCommentaries,hasDatedText:!!m.hasDatedText,
      legacy:!m.gen,
      importReport:m.importReport||null,
      lastOpenedAt:m.lastOpenedAt||null,usageCount:m.usageCount||0
    })),
    pinyin:pinyinDebug(),
    events:diagEvents.slice(-120)
  };
}
async function cleanOldGenerations(){
  const metas=await allBooks();let cleaned=0;
  for(const m of metas){if(!m.gen)continue;try{await purgeOldGenerations(m.id,m.gen);cleaned++}catch(e){logDiag('error','清理旧版本失败：'+m.id,e&&e.message)}}
  return cleaned;
}
function registerLanguagePack(code,meta,messages,persist=true){
  if(!code||!messages||typeof messages!=='object')return false;
  code=String(code).toLowerCase();if(!/^[a-z]{2,8}$/.test(code))return false;
  UI_LANGS[code]={name:(meta&&meta.name)||code,locale:(meta&&meta.locale)||code,button:(meta&&meta.button)||code.slice(0,2).toUpperCase()};
  I18N[code]=Object.assign({},I18N[code]||{},messages);
  if(persist){try{const saved=JSON.parse(localStorage.getItem('offlineLibraryLanguagePacks')||'{}');saved[code]={meta:{name:UI_LANGS[code].name,locale:UI_LANGS[code].locale,button:UI_LANGS[code].button},messages};localStorage.setItem('offlineLibraryLanguagePacks',JSON.stringify(saved))}catch(e){}}
  return true;
}
try{const saved=JSON.parse(localStorage.getItem('offlineLibraryLanguagePacks')||'{}');for(const [code,pack] of Object.entries(saved))registerLanguagePack(code,pack.meta,pack.messages,false);const wanted=localStorage.getItem('offlineLibraryUiLang');if(wanted&&UI_LANGS[wanted])uiLang=wanted}catch(e){}
try{window.__offlineLibrary={version:APP_VERSION,cryptoMode:hasWebCrypto()?'webcrypto':'js-fallback',diagnostics:buildDiagnostics,cleanOldGenerations,pinyinDebug,registerLanguagePack,setUiLanguage:(code)=>setUiLang(code),events:()=>diagEvents.slice()} }catch(e){}
