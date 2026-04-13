export const extractAllArtifacts = (msgs: any[]) => {
  const allArtifacts: { code: string, lang: string, filename: string, msgIndex: number }[] = [];
  const ticks = ['`', '`', '`'].join('');
  const pattern = ticks + '([a-zA-Z0-9_+-]*)(?:.*?(?:filename|name|file)=["\']?([^"\'\\s]+)["\']?)?[ \\t]*\\n([\\s\\S]*?)' + ticks;
  const regex = new RegExp(pattern, 'g');

  msgs.forEach((m, idx) => {
     if (m.role === 'ai' || m.role === 'system') {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(m.content)) !== null) {
           let lang = match[1] ? String(match[1]).trim().toLowerCase() : 'text';
           let filename = match[2] ? String(match[2]).trim() : '';
           let code = match[3] ? String(match[3]).trim() : '';
           
           if (!filename) {
               const firstLine = code.split('\n')[0] || '';
               // 🔥 Using your exact approved regex!
               const nameMatch = firstLine.match(/^(?:\/\/#|\/\/|#|--)\s*(?:filename\s*[:=]\s*)?(.+\.\w+)/i);
               
               if (nameMatch && nameMatch[1]) {
                   filename = nameMatch[1].trim();
                   const newlineIndex = code.indexOf('\n');
                   if (newlineIndex !== -1) code = code.substring(newlineIndex + 1).trim();
               }
           }

           // Smart Fallbacks for HTML, CSS, and unnamed classes/functions
           if (!filename) {
               const ext = lang === 'text' ? 'txt' : lang.replace('javascript', 'js').replace('typescript', 'ts').replace('python', 'py');
               if (lang === 'html' || code.toLowerCase().includes('<!doctype html>') || code.toLowerCase().includes('<html')) {
                   filename = 'index.html';
               } else if (lang === 'css' || code.includes('margin:') || code.includes('padding:')) {
                   filename = 'style.css'; 
               } else {
                   const classMatch = code.match(/class\s+([A-Z][a-zA-Z0-9_]*)/);
                   const funcMatch = code.match(/(?:function|const|let)\s+([a-zA-Z0-9_]+)/);
                   if (classMatch && classMatch[1]) filename = `${classMatch[1]}.${ext}`;
                   else if (funcMatch && funcMatch[1]) filename = `${funcMatch[1]}.${ext}`;
                   else filename = `snippet_${idx}_${allArtifacts.length + 1}.${ext}`;
               }
           }

           allArtifacts.push({ lang, filename, code, msgIndex: idx });
        }
     }
  });

  // 🔥 VIRTUAL FILE SYSTEM DEDUPLICATION:
  // We loop chronologically. If a file with the same name is generated again, 
  // it overwrites the old one in the Map. This guarantees we only return the LATEST state of each file!
  const latestFiles = new Map<string, any>();
  allArtifacts.forEach(art => {
      latestFiles.set(art.filename, art);
  });

  return Array.from(latestFiles.values());
};