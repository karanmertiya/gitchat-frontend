export const getBranchDepth = (branch: any, branches: any[]) => {
  let depth = 0; let curr = branch;
  while (curr.parent_branch_id) {
      depth++;
      curr = branches.find((b: any) => b.id === curr.parent_branch_id) || {};
  }
  return depth;
};

export const computeLineDiff = (oldStr: string, newStr: string) => {
  const oldL = oldStr.split('\n');
  const newL = newStr.split('\n');
  const dp = Array(oldL.length + 1).fill(null).map(() => Array(newL.length + 1).fill(0));
  
  for (let i = 1; i <= oldL.length; i++) {
      for (let j = 1; j <= newL.length; j++) {
          if (oldL[i - 1] === newL[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
          else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
  }
  
  const diff = [];
  let i = oldL.length, j = newL.length;
  while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldL[i - 1] === newL[j - 1]) {
          diff.unshift({ type: 'unchanged', value: oldL[i - 1] });
          i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          diff.unshift({ type: 'added', value: newL[j - 1] });
          j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
          diff.unshift({ type: 'removed', value: oldL[i - 1] });
          i--;
      }
  }
  return diff;
};

export const downloadCode = (codeToDownload: string, filename: string) => {
  const blob = new Blob([codeToDownload], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
};

export const downloadAllArtifacts = async (artifacts: any[], branchName: string) => {
    try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        artifacts.forEach(art => {
            zip.file(art.filename, art.code);
        });
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url; 
        a.download = `artifacts_${branchName || 'workspace'}.zip`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) {
        alert("Failed to create ZIP. Make sure you ran 'npm install jszip'");
    }
};

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
           let lang = match[1] ? String(match[1]).trim() : 'text';
           let filename = match[2] ? String(match[2]).trim() : '';
           let code = match[3] ? String(match[3]).trim() : '';
           
           if (!filename) {
               const firstLine = code.split('\n')[0] || '';
               // Your exact injected custom Regex:
               const nameMatch = firstLine.match(/^(?:\/\/#|\/\/|#|--)\s*(?:filename\s*[:=]\s*)?([\w.-]+\.\w+)/i);
               if (nameMatch && nameMatch[1]) {
                   filename = nameMatch[1].trim();
                   const newlineIndex = code.indexOf('\n');
                   if (newlineIndex !== -1) code = code.substring(newlineIndex + 1).trim();
               }
           }

           if (!filename) {
               const ext = lang === 'text' ? 'txt' : lang.replace('javascript', 'js').replace('typescript', 'ts').replace('python', 'py');
               if (lang === 'html' || code.toLowerCase().includes('<!doctype html>') || code.toLowerCase().includes('<html')) {
                   filename = 'index.html';
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
  return allArtifacts;
};

export const generateMarkdownString = (activeBranch: any, messages: any[]) => {
  const date = new Date().toLocaleDateString();
  let mdContent = `# Timeline Export: ${activeBranch?.name || 'Workspace'}\n**Date:** ${date}\n\n---\n\n`;
  messages.forEach((m) => {
    const roleName = m.role === 'user' ? '👤 **User**' : m.role === 'system' ? '⚙️ **System**' : '🤖 **AI Assistant**';
    const cleanContent = m.content.replace(/---START_ATTACHMENT:(.*?)---[\s\S]*?---END_ATTACHMENT---/g, '> 📎 *Attached Document: `$1`*');
    mdContent += `### ${roleName}\n${cleanContent}\n\n---\n\n`;
  });
  return mdContent;
};

export const exportMD = (activeBranch: any, messages: any[], setExportMenuOpen: (v: boolean) => void) => {
  if (!activeBranch || messages.length === 0) return;
  const blob = new Blob([generateMarkdownString(activeBranch, messages)], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Timeline_${activeBranch.name}.md`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  setExportMenuOpen(false);
};

export const exportPDF = (activeBranch: any, messages: any[], setExportMenuOpen: (v: boolean) => void) => {
  if (!activeBranch || messages.length === 0) return;
  const mdContent = generateMarkdownString(activeBranch, messages);
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert("Please allow pop-ups to generate the PDF."); return; }

  const escapedMd = mdContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>Timeline Export: ${activeBranch.name}</title>
          <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-dark.min.css">
          <style>
              @page { margin: 15mm; size: auto; }
              body { padding: 20px; margin: 0; background: #0d1117; color: #c9d1d9; -webkit-print-color-adjust: exact; color-adjust: exact; }
              .markdown-body { box-sizing: border-box; max-width: 100% !important; margin: 0 auto; font-family: -apple-system, sans-serif; background: #0d1117; }
              pre, code { white-space: pre-wrap !important; word-break: break-word !important; background: #161b22 !important; border: 1px solid #30363d; border-radius: 6px; }
          </style>
      </head>
      <body>
          <textarea id="raw-md" style="display:none;">${escapedMd}</textarea>
          <article class="markdown-body" id="content">Building PDF... Please wait.</article>
          <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
          <script>
              setTimeout(() => {
                  try {
                      const md = document.getElementById('raw-md').value;
                      document.getElementById('content').innerHTML = marked.parse(md);
                      setTimeout(() => { window.print(); window.close(); }, 500);
                  } catch(e) {
                      document.getElementById('content').innerHTML = "Failed to render PDF: " + e.message;
                  }
              }, 100);
          </script>
      </body>
      </html>
  `);
  printWindow.document.close();
  setExportMenuOpen(false);
};