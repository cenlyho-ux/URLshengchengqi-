import React, { useState, useEffect } from 'react';
import { Download, FileText, Link as LinkIcon, Trash2, Edit2, Archive, Check } from 'lucide-react';
import JSZip from 'jszip';

interface ParsedLink {
  id: string;
  title: string;
  url: string;
}

export default function App() {
  const [inputText, setInputText] = useState<string>('');
  const [parsedLinks, setParsedLinks] = useState<ParsedLink[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [findText, setFindText] = useState<string>('');
  const [replaceText, setReplaceText] = useState<string>('');

  // Sample data to help user understand the format
  const loadExample = () => {
    setInputText(`【腾讯文档】票务操作手册2.0-20250701
https://docs.qq.com/doc/DUWZiQkh2Q2pOVGRv

设计规范指南
https://www.figma.com/file/example

https://github.com/microsoft
(这个链接没有提供标题，将自动生成)`);
  };

  const sanitizeFilename = (name: string) => {
    return name.replace(/[\\/:*?"<>|]/g, '_').trim();
  };

  const handleParse = () => {
    const lines = inputText.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    const results: ParsedLink[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(urlRegex);
      
      if (match) {
        const url = match[1];
        let title = `链接_${results.length + 1}`;

        // 1. Try to get title from the text before the URL on the same line
        const textBeforeUrl = line.substring(0, match.index).trim();
        if (textBeforeUrl) {
          title = textBeforeUrl;
        } 
        // 2. Otherwise, look at the previous line
        else if (i > 0 && !lines[i - 1].match(urlRegex)) {
          title = lines[i - 1];
        } 
        // 3. Look at the next line if it's not a URL (sometimes people put title after)
        else if (i < lines.length - 1 && !lines[i + 1].match(urlRegex)) {
          title = lines[i + 1];
        }

        // Clean up the title for use as a filename
        title = sanitizeFilename(title);
        if (!title) title = '未命名快捷方式';

        results.push({
          id: Math.random().toString(36).substring(2, 9),
          title,
          url,
        });
      }
    }
    setParsedLinks(results);
  };

  const generateUrlFileContent = (url: string) => {
    return `[InternetShortcut]\nURL=${url}`;
  };

  const downloadSingle = (link: ParsedLink) => {
    const content = generateUrlFileContent(link.url);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${link.title}.url`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllZip = async () => {
    if (parsedLinks.length === 0) return;
    
    const zip = new JSZip();
    
    // Keep track of names to prevent duplicates in ZIP
    const nameCount: Record<string, number> = {};

    parsedLinks.forEach((link) => {
      let filename = `${link.title}`;
      
      if (nameCount[filename]) {
        nameCount[filename]++;
        filename = `${filename} (${nameCount[filename]})`;
      } else {
        nameCount[filename] = 1;
      }
      
      const content = generateUrlFileContent(link.url);
      zip.file(`${filename}.url`, content);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = '快捷方式集合.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const removeLink = (id: string) => {
    setParsedLinks(parsedLinks.filter(l => l.id !== id));
  };

  const startEditing = (link: ParsedLink) => {
    setEditingId(link.id);
    setEditTitle(link.title);
  };

  const saveEdit = (id: string) => {
    setParsedLinks(parsedLinks.map(l => 
      l.id === id ? { ...l, title: sanitizeFilename(editTitle) || '未命名快捷方式' } : l
    ));
    setEditingId(null);
  };

  const addNumbering = () => {
    setParsedLinks(prev => prev.map((link, index) => {
      const prefix = String(index + 1).padStart(2, '0');
      return { ...link, title: `${prefix} ${link.title}` };
    }));
  };

  const handleReplace = () => {
    if (!findText) return;
    setParsedLinks(prev => prev.map(link => {
      const newTitle = link.title.split(findText).join(replaceText);
      return { ...link, title: sanitizeFilename(newTitle) || '未命名快捷方式' };
    }));
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* Header Navigation */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <LinkIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">
            ShortcutGen<span className="text-blue-600">.url</span>
          </span>
        </div>
        <div className="flex gap-6 text-sm font-medium text-slate-500">
          <button onClick={loadExample} className="hover:text-blue-600 transition-colors">加载示例 (Load Example)</button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* Left Panel: Input Configuration */}
        <section className="w-full md:w-[400px] bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6 shrink-0">
          <div>
            <h2 className="text-lg font-semibold mb-1">批量生成快捷方式</h2>
            <p className="text-sm text-slate-500">从文本中提取链接，生成本地 .url 文件</p>
          </div>

          <div className="flex-1 flex flex-col space-y-4">
            <div className="flex-1 flex flex-col space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">文本输入 (TEXT INPUT)</label>
              <textarea
                className="flex-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
                placeholder="请在此处粘贴包含标题和链接的文本...&#10;&#10;例如：&#10;【腾讯文档】票务操作手册2.0-20250701&#10;https://docs.qq.com/doc/DUWZiQkh2Q2pOVGRv"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleParse}
                disabled={!inputText.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all"
              >
                <FileText className="w-5 h-5" />
                解析并提取链接
              </button>
            </div>
          </div>

          <div className="mt-auto p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex gap-3">
              <div className="w-5 h-5 text-blue-600 shrink-0 flex items-center justify-center rounded-full bg-blue-100">
                 <FileText className="w-3 h-3" />
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                <strong>工作原理：</strong> 自动从文本中提取 URL 和相邻行的标题，生成标准的 Internet Shortcut (.url) 文件。双击即可在默认浏览器中打开。
              </p>
            </div>
          </div>
        </section>

        {/* Right Panel: Visual Preview & History */}
        <section className="flex-1 flex flex-col gap-6 min-w-0">
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <span className="text-sm font-semibold">提取结果 ({parsedLinks.length})</span>
              {parsedLinks.length > 1 && (
                <button
                  onClick={downloadAllZip}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  打包下载 ZIP
                </button>
              )}
            </div>

            {parsedLinks.length > 0 && (
              <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-4 text-sm shrink-0">
                <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                  <button 
                    onClick={addNumbering} 
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded text-slate-700 text-xs font-medium shadow-sm transition-colors"
                  >
                    添加序号 (01, 02...)
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="查找文本 (如：腾讯文档)" 
                    value={findText} 
                    onChange={(e) => setFindText(e.target.value)} 
                    className="px-3 py-1.5 border border-slate-200 rounded text-xs w-40 focus:ring-1 focus:ring-blue-500 outline-none" 
                  />
                  <input 
                    type="text" 
                    placeholder="替换为(可为空)" 
                    value={replaceText} 
                    onChange={(e) => setReplaceText(e.target.value)} 
                    className="px-3 py-1.5 border border-slate-200 rounded text-xs w-32 focus:ring-1 focus:ring-blue-500 outline-none" 
                  />
                  <button 
                    onClick={handleReplace} 
                    disabled={!findText}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white rounded text-slate-700 text-xs font-medium shadow-sm transition-colors"
                  >
                    批量替换
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto">
              {parsedLinks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <LinkIcon className="w-12 h-12 mb-3 text-slate-300" strokeWidth={1.5} />
                  <p className="text-sm">暂无提取结果，请在左侧输入内容并解析</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400 sticky top-0 bg-white/95 backdrop-blur shadow-sm">
                      <th className="px-6 py-3 font-bold w-1/2">File Name</th>
                      <th className="px-6 py-3 font-bold w-1/3">Target URL</th>
                      <th className="px-6 py-3 font-bold w-1/6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {parsedLinks.map((link) => (
                      <tr key={link.id} className="border-t border-slate-100 hover:bg-slate-50 group transition-colors">
                        <td className="px-6 py-3 font-medium">
                          {editingId === link.id ? (
                            <div className="flex items-center">
                              <input
                                type="text"
                                className="w-full border border-blue-300 rounded-md px-2 py-1 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit(link.id)}
                                autoFocus
                              />
                              <button onClick={() => saveEdit(link.id)} className="ml-2 text-green-600 p-1 hover:bg-green-50 rounded shrink-0">
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <span className="truncate max-w-[200px] xl:max-w-[400px]" title={link.title}>{link.title}.url</span>
                              <button 
                                onClick={() => startEditing(link)}
                                className="ml-2 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                title="重命名"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-3 text-slate-500">
                          <div className="truncate max-w-[150px] xl:max-w-[300px]" title={link.url}>
                            {link.url}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => downloadSingle(link)}
                              className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded hover:bg-blue-50"
                              title="下载文件"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeLink(link.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded hover:bg-red-50"
                              title="移除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="h-10 bg-slate-800 text-slate-400 flex items-center justify-between px-8 text-[10px] uppercase tracking-widest shrink-0">
        <div className="flex gap-4">
          <span>Session: Local-Only</span>
          <span>Cloud Sync: Disabled</span>
        </div>
        <div>
          © 2024 ShortcutGen Utility • Precision Engineering
        </div>
      </footer>
    </div>
  );
}
