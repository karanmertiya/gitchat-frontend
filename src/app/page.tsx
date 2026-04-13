"use client";
import React, { useState, useEffect, useRef } from 'react';
import { GitBranch, GitMerge, Send, Zap, Loader2, GitFork, X, Save, Paperclip, LogOut, Code, Globe, File, CheckCircle2, Maximize2, MessageCircle, Share2, Download, Trash2, User, Library, DownloadCloud, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function DialogTreeHome() {
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<{name: string, base64: string, type: string, ext: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [workspace, setWorkspace] = useState<any>(null);
  const [activeBranch, setActiveBranch] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const [activeArtifact, setActiveArtifact] = useState<{code: string, lang: string, filename: string} | null>(null);
  const [isArtifactSidebarOpen, setIsArtifactSidebarOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  
  const [isChitchatOpen, setIsChitchatOpen] = useState(false);
  const [chitchatInput, setChitchatInput] = useState("");
  const [chitchatMsgs, setChitchatMsgs] = useState<any[]>([]);
  const [chitchatLoading, setChitchatLoading] = useState(false);

  const [forkModal, setForkModal] = useState({ isOpen: false, messageId: null as string | null, name: "", isEphemeral: true });
  
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [mainArtifacts, setMainArtifacts] = useState<{code: string, lang: string, filename: string}[]>([]);
  const [isDiffLoading, setIsDiffLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setIsInitializing(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setIsInitializing(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const setup = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const joinId = urlParams.get('workspace');

        const data = await api.init(session.user.id, "My First Workspace", joinId);
        
        if (data.error) throw new Error(data.error);
        if (!data.workspace) throw new Error("Backend connection failed.");

        setWorkspace(data.workspace);
        setActiveBranch(data.branch);
        const branchData = await api.getBranches(data.workspace.id);
        setBranches(branchData.branches);
        
        setIsInitializing(false);
      } catch (err: any) {
        console.error("🔥 CRITICAL SETUP FAILURE:", err);
        alert(`Backend Error: ${err.message}\n\nLogging out to prevent frozen UI.`);
        await supabase.auth.signOut();
        setSession(null);
        setIsInitializing(false);
      }
    };
    setup();
  }, [session]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!activeBranch) return;
      setSwitching(true);
      setActiveArtifact(null); 
      try {
        const historyData = await api.getMessages(activeBranch.id);
        setMessages(historyData.messages || []);
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setSwitching(false);
      }
    };
    loadHistory();
  }, [activeBranch]);

  useEffect(() => {
    if (!workspace) return;
    
    api.getChitchat(workspace.id).then(res => setChitchatMsgs(res.messages || []));

    const channel = supabase.channel('room_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (activeBranch) api.getMessages(activeBranch.id).then(res => setMessages(res.messages || []));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chitchat_messages' }, () => {
        api.getChitchat(workspace.id).then(res => setChitchatMsgs(res.messages || []));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, () => {
        api.getBranches(workspace.id).then(res => setBranches(res.branches || []));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [workspace, activeBranch]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true); setAuthError(''); setVerifyMessage('');
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName } } });
        if (error) throw error;
        if (data.user && !data.session) {
            setVerifyMessage('Registration successful! Please check your email to verify your account.');
            setAuthEmail(''); setAuthPassword(''); setAuthName(''); setIsSignUp(false);
        } else {
            setVerifyMessage('Account created successfully!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => { await supabase.auth.signInWithOAuth({ provider }); };
  const handleLogout = async () => { await supabase.auth.signOut(); setWorkspace(null); setActiveBranch(null); setMessages([]); };

  const handleSend = async () => {
    const finalPrompt = input.trim();
    if (!finalPrompt && selectedFiles.length === 0) return;
    if (!activeBranch) return;

    setInput(""); 
    const currentAttachments = [...selectedFiles];
    setSelectedFiles([]); 
    setLoading(true);

    const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
    
    let displayPrompt = finalPrompt;
    if (currentAttachments.length > 0) {
       displayPrompt += `\n\n*(Uploading ${currentAttachments.length} attachments...)*`;
    }
    setMessages(prev => [...prev, { role: 'user', content: displayPrompt, id: 'temp' }]);

    try {
      const data = await api.chat(activeBranch.id, finalPrompt, lastMsgId, messages, currentAttachments);
      if (data.error) throw new Error(data.error);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== 'temp'));
      alert(`Failed to get AI response: \n\n${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitFork = async () => {
    if (!forkModal.name.trim() || !forkModal.messageId) return;
    setLoading(true); setForkModal(prev => ({ ...prev, isOpen: false })); 
    try {
      await api.branch(workspace.id, forkModal.name, forkModal.isEphemeral, forkModal.messageId, activeBranch.id);
    } catch (err) { alert("Failed to create new timeline."); } 
    finally { setLoading(false); }
  };

  const deleteBranch = async (branchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this branch?")) return;
    try {
      await api.deleteBranch(branchId);
      if (activeBranch?.id === branchId) setActiveBranch(branches.find(b => b.name === 'main') || null);
    } catch (err) { console.error("Failed to delete", err); }
  };

  const makePermanent = async () => {
    if (!activeBranch) return;
    try { await api.toggleEphemeral(activeBranch.id); } catch (err) {}
  };

  const extractAllArtifacts = (msgs: any[]) => {
    const allArtifacts: { code: string, lang: string, filename: string, msgIndex: number }[] = [];
    
    const ticks = ['`', '`', '`'].join('');
    const pattern = ticks + '([a-zA-Z0-9_+-]*)(?:.*?(?:filename|name|file)=["\']?([^"\'\\s]+)["\']?)?[ \\t]*\\n([\\s\\S]*?)' + ticks;
    const regex = new RegExp(pattern, 'g');

    msgs.forEach((m, idx) => {
       if (m.role === 'ai' || m.role === 'system') {
          let match;
          regex.lastIndex = 0;
          while ((match = regex.exec(m.content)) !== null) {
             let code = match[3] ? String(match[3]).trim() : '';
             let filename = match[2] ? String(match[2]).trim() : '';
             let lang = match[1] ? String(match[1]).trim() : 'text';
             
             if (!filename) {
                 const firstLine = code.split('\n')[0] || '';
                 const nameMatch = firstLine.match(/^(?:\/\/#|\/\/|#|--)\s*(?:filename\s*[:=]\s*)?(.+\.\w+)/i);
                 
                 if (nameMatch && nameMatch[1]) {
                     filename = nameMatch[1].trim();
                     const newlineIndex = code.indexOf('\n');
                     if (newlineIndex !== -1) {
                         code = code.substring(newlineIndex + 1).trim();
                     }
                 } else {
                     filename = `snippet_${idx}_${allArtifacts.length}.${lang === 'text' ? 'txt' : lang}`;
                 }
             }
             allArtifacts.push({ lang, filename, code, msgIndex: idx });
          }
       }
    });
    return allArtifacts;
  };

  const initiateMerge = async () => {
    if (!activeBranch || activeBranch.name === 'main') { 
        alert("You are already in the main timeline! You must be in a branch to merge."); 
        return; 
    }
    
    setPrModalOpen(true);
    setIsDiffLoading(true);
    
    try {
        const mainBranch = branches.find(b => b.name === 'main');
        if (mainBranch) {
            const res = await api.getMessages(mainBranch.id);
            if (res.messages) {
                const oldArts = extractAllArtifacts(res.messages);
                setMainArtifacts(oldArts);
            }
        }
    } catch (err) {
        console.error("Failed to load main artifacts for diff", err);
    }
    
    setIsDiffLoading(false);
  };

  const confirmMerge = async () => {
    const mainBranch = branches.find(b => b.name === 'main');
    const latestSourceMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (!mainBranch || !latestSourceMsgId) return;

    setLoading(true);
    setPrModalOpen(false);
    try {
      const res = await api.merge(activeBranch.id, mainBranch.id, latestSourceMsgId, null, messages);
      if(res.error) throw new Error(res.error);
      
      await api.deleteBranch(activeBranch.id);
      setActiveBranch(mainBranch); 
    } catch(e: any) {
      alert(`Merge failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const computeLineDiff = (oldStr: string, newStr: string) => {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    if (files.some(f => f.size > 1024 * 1024 * 10)) { 
      alert("One of your files is too large. Keep under 10MB per file."); return; 
    }

    const newFiles = await Promise.all(files.map(file => {
      return new Promise<{name: string, base64: string, type: string, ext: string}>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ name: file.name, base64: reader.result as string, type: file.type, ext: file.name.split('.').pop() || 'txt' });
        };
        reader.readAsDataURL(file);
      });
    }));
    setSelectedFiles(prev => [...prev, ...newFiles as any]);
    if(fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const downloadCode = (codeToDownload: string, filename: string) => {
    const blob = new Blob([codeToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const generateMarkdownString = () => {
    const date = new Date().toLocaleDateString();
    let mdContent = `# Timeline Export: ${activeBranch?.name || 'Workspace'}\n**Date:** ${date}\n\n---\n\n`;
    
    messages.forEach((m) => {
      const roleName = m.role === 'user' ? '👤 **User**' : m.role === 'system' ? '⚙️ **System**' : '🤖 **AI Assistant**';
      const cleanContent = m.content.replace(/---START_ATTACHMENT:(.*?)---[\s\S]*?---END_ATTACHMENT---/g, '> 📎 *Attached Document: `$1`*');
      mdContent += `### ${roleName}\n${cleanContent}\n\n---\n\n`;
    });
    return mdContent;
  };

  const exportMD = () => {
    if (!activeBranch || messages.length === 0) return;
    const blob = new Blob([generateMarkdownString()], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Timeline_${activeBranch.name}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const exportPDF = () => {
    if (!activeBranch || messages.length === 0) return;
    const mdContent = generateMarkdownString();
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert("Please allow pop-ups to generate the PDF."); return; }

    const escapedMd = mdContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Timeline Export: ${activeBranch.name}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-dark.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
            <style>
                @page { margin: 10mm; size: auto; }
                body { padding: 20px; margin: 0; background: #0d1117; color: #c9d1d9; -webkit-print-color-adjust: exact; color-adjust: exact; }
                .markdown-body { box-sizing: border-box; max-width: 100% !important; margin: 0 auto; font-family: -apple-system, sans-serif; background: #0d1117; }
                pre, code { white-space: pre-wrap !important; word-break: break-word !important; background: #161b22 !important; border: 1px solid #30363d; border-radius: 6px; }
                img { max-width: 100% !important; page-break-inside: avoid; }
                pre, blockquote, tr, td, th { page-break-inside: avoid; }
                .header { border-bottom: 1px solid #30363d; padding-bottom: 10px; margin-bottom: 20px; font-family: monospace; color: #8b949e; font-size: 12px; }
            </style>
        </head>
        <body class="markdown-body">
            <div class="header">DialogTree Workspace // Branch: ${activeBranch.name} // Generated: ${new Date().toLocaleString()}</div>
            <textarea id="raw-md" style="display:none;">${escapedMd}</textarea>
            <article id="content">Building beautiful PDF... Please wait.</article>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
            <script>
                setTimeout(() => {
                    try {
                        const md = document.getElementById('raw-md').value;
                        marked.setOptions({
                            highlight: function(code, lang) {
                                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                                return hljs.highlight(code, { language }).value;
                            }
                        });
                        document.getElementById('content').innerHTML = marked.parse(md);
                        setTimeout(() => { window.print(); window.close(); }, 800);
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

  const handleChitchatSend = async () => {
    if (!chitchatInput.trim() || !workspace) return;
    const msg = chitchatInput;
    setChitchatInput("");
    const userName = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
    
    if (msg.includes('@gemini')) {
        setChitchatLoading(true);
        try {
            const aiHistory = chitchatMsgs.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }]}));
            await api.chitchat(workspace.id, userName, msg, aiHistory);
        } catch (e) {} finally { setChitchatLoading(false); }
    } else {
        await api.chitchat(workspace.id, userName, msg);
    }
  };

  const copyShareLink = () => {
    if (workspace?.id) {
        const url = `${window.location.origin}?workspace=${workspace.id}`;
        navigator.clipboard.writeText(url);
        alert("Invite link copied to clipboard!");
    }
  };

  const MarkdownComponents = {
    code({node, inline, className, children, ...props}: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      return !inline && match ? (
        <div className="relative group mt-4 mb-4">
          <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button onClick={() => setActiveArtifact({ code: codeString, lang: match[1], filename: 'snippet' })} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg transition-all"><Code size={14}/> Open in Editor</button>
          </div>
          <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-x-auto text-[13px] leading-relaxed"><code className={className} {...props}>{children}</code></pre>
        </div>
      ) : (<code className="bg-zinc-800 text-indigo-300 px-1.5 py-0.5 rounded-md text-[13px]" {...props}>{children}</code>)
    }
  };

  const getBranchDepth = (branch: any) => {
    let depth = 0; let curr = branch;
    while (curr.parent_branch_id) {
        depth++;
        curr = branches.find(b => b.id === curr.parent_branch_id) || {};
    }
    return depth;
  };

  const timelineArtifacts = extractAllArtifacts(messages);

  if (isInitializing) {
     return (
        <div className="flex h-screen bg-zinc-950 items-center justify-center font-sans">
           <div className="flex flex-col items-center gap-4">
               <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-500/20 animate-pulse"><GitBranch size={32} className="text-white" /></div>
               <Loader2 size={24} className="animate-spin text-zinc-500" />
           </div>
        </div>
     )
  }

  if (!session) {
    return (
        <div className="flex h-screen bg-zinc-950 font-sans">
          <div className="hidden lg:flex flex-col justify-between w-1/2 bg-zinc-900 border-r border-zinc-800 p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20"><GitBranch size={24} className="text-white" /></div>
              <h1 className="text-2xl font-bold text-white tracking-tight">DialogTree</h1>
            </div>
            <div className="relative z-10">
              <h2 className="text-4xl font-semibold text-white leading-tight mb-4">Version control<br/>for AI conversations.</h2>
              <p className="text-zinc-400 text-lg max-w-md">Never lose your train of thought. Fork timelines, upload context, and merge conclusions into a single source of truth.</p>
            </div>
            <div className="relative z-10 text-zinc-500 text-sm">© 2026 DialogTree Technologies</div>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center p-8 bg-zinc-950">
            <div className="w-full max-w-md">
              <div className="mb-8 text-center lg:text-left">
                <h3 className="text-2xl font-semibold text-white mb-2">Welcome back</h3>
                <p className="text-zinc-400 text-sm">Sign in to access your workspaces.</p>
              </div>
              <div className="flex gap-3 mb-6">
                <button onClick={() => handleOAuth('google')} className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm font-medium transition-all"><Globe size={16} className="text-zinc-400" /> Google</button>
                <button onClick={() => handleOAuth('github')} className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm font-medium transition-all"><Code size={16} className="text-zinc-400" /> GitHub</button>
              </div>
              <div className="relative flex items-center py-4 mb-2">
                <div className="flex-grow border-t border-zinc-800"></div><span className="flex-shrink-0 mx-4 text-zinc-500 text-xs uppercase tracking-widest">Or continue with email</span><div className="flex-grow border-t border-zinc-800"></div>
              </div>
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {authError && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg">{authError}</div>}
                {verifyMessage && <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-sm p-3 rounded-lg flex items-start gap-2"><CheckCircle2 size={18} className="shrink-0 mt-0.5" /><p>{verifyMessage}</p></div>}
                
                {isSignUp && (
                  <div><label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Full Name</label><input type="text" value={authName} onChange={e => setAuthName(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500" placeholder="Jane Doe" /></div>
                )}
                
                <div><label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500" placeholder="engineer@example.com" /></div>
                <div><label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500" placeholder="••••••••" /></div>
                <button type="submit" disabled={authLoading} className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2 mt-4">{authLoading ? <Loader2 size={18} className="animate-spin text-zinc-500" /> : null}{isSignUp ? 'Create Account' : 'Sign In'}</button>
              </form>
              <div className="mt-8 text-center"><button onClick={() => { setIsSignUp(!isSignUp); setVerifyMessage(''); setAuthError(''); }} className="text-sm text-zinc-500 hover:text-indigo-400 transition-colors">{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}</button></div>
            </div>
          </div>
        </div>
      );
    }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">
      
      {/* FLOATING MULTIPLAYER CHITCHAT */}
      <div className="absolute bottom-6 right-6 z-50">
         {isChitchatOpen ? (
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-80 shadow-2xl flex flex-col h-[450px] overflow-hidden">
               <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                  <span className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><MessageCircle size={16} className="text-indigo-400"/> Chitchat Room</span>
                  <button onClick={() => setIsChitchatOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16}/></button>
               </div>
               <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
                  <div className="bg-zinc-800/50 p-3 rounded-xl text-[13px] text-zinc-400 border border-zinc-800 text-center">
                      Chat with peers in real-time. Tag <strong className="text-indigo-400">@gemini</strong> to summon the AI.
                  </div>
                  {chitchatMsgs.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <span className="text-[10px] text-zinc-500 mb-1 px-1">{m.sender_name}</span>
                          <div className={`p-2.5 rounded-xl max-w-[85%] ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-bl-sm'}`}>
                             <div className="prose prose-invert prose-p:leading-snug max-w-none text-[13px]">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                             </div>
                          </div>
                      </div>
                  ))}
                  {chitchatLoading && <div className="text-xs text-zinc-500 flex items-center gap-2"><Loader2 size={12} className="animate-spin text-indigo-500"/> Gemini is typing...</div>}
               </div>
               <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex gap-2">
                  <input type="text" placeholder="Type message..." value={chitchatInput} onKeyDown={e => e.key === 'Enter' && handleChitchatSend()} onChange={e => setChitchatInput(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
                  <button onClick={handleChitchatSend} disabled={!chitchatInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"><Send size={14}/></button>
               </div>
            </div>
         ) : (
            <button onClick={() => setIsChitchatOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-500/20 transition-transform hover:scale-105">
               <MessageCircle size={24} />
            </button>
         )}
      </div>

      {/* DIVERGE TIMELINE MODAL */}
      {forkModal.isOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><GitFork size={20} className="text-indigo-400"/> Diverge Timeline</h2><button onClick={() => setForkModal(prev => ({ ...prev, isOpen: false }))} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button></div>
            <input type="text" autoFocus placeholder="Name this timeline..." value={forkModal.name} onChange={e => setForkModal(prev => ({ ...prev, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submitFork()} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 mb-4 focus:outline-none focus:border-indigo-500" />
            <div className="flex items-center gap-3 mb-6 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
              <input type="checkbox" id="ephemeral" checked={forkModal.isEphemeral} onChange={e => setForkModal(prev => ({ ...prev, isEphemeral: e.target.checked }))} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-600" />
              <label htmlFor="ephemeral" className="text-sm text-zinc-300 flex items-center gap-2 cursor-pointer"><Zap size={14} className={forkModal.isEphemeral ? "text-amber-400" : "text-zinc-600"}/> Temporary Workspace</label>
            </div>
            <div className="flex justify-end gap-3"><button onClick={() => setForkModal(prev => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-sm text-zinc-400">Cancel</button><button onClick={submitFork} disabled={!forkModal.name.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">Create Branch</button></div>
          </div>
        </div>
      )}

      {/* PR MERGE MODAL (WITH TRUE SIDE-BY-SIDE DIFF VIEWER) */}
      {prModalOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-[95vw] lg:max-w-6xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
               <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100"><GitMerge size={22} className="text-emerald-400"/> Open Merge Request</h2>
                  <p className="text-sm text-zinc-400 mt-1">Review side-by-side differences before squashing into the main branch.</p>
               </div>
               <button onClick={() => setPrModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-zinc-950 flex flex-col gap-6">
               <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                  <div className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-mono"><GitBranch size={16} className="text-indigo-400"/> {activeBranch?.name}</div>
                  <span className="text-zinc-500">→</span>
                  <div className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-mono"><GitBranch size={16} className="text-zinc-400"/> main</div>
               </div>
               {isDiffLoading ? (
                   <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
                       <Loader2 size={24} className="animate-spin text-emerald-500" />
                       <p className="text-sm">Analyzing side-by-side differences against main...</p>
                   </div>
               ) : (
                   <div>
                      <h3 className="text-zinc-300 text-sm font-semibold mb-3">Files Changed ({timelineArtifacts.length})</h3>
                      {timelineArtifacts.length === 0 ? (
                         <div className="text-center p-8 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-sm">No code files were generated in this timeline. The AI will summarize the conversation text instead.</div>
                      ) : (
                         <div className="flex flex-col gap-8">
                            {timelineArtifacts.map((art, idx) => {
                               const oldArt = mainArtifacts.slice().reverse().find(a => a.filename === art.filename);
                               const isNew = !oldArt;
                               const isUnchanged = oldArt && oldArt.code === art.code;
                               
                               let sbsRows: {leftNum: number|null, leftCode: string, leftType: string, rightNum: number|null, rightCode: string, rightType: string}[] = [];
                               if (oldArt && !isUnchanged) {
                                   const diffLines = computeLineDiff(oldArt.code, art.code);
                                   let lLine = 1, rLine = 1;
                                   for (let i = 0; i < diffLines.length; i++) {
                                       const line = diffLines[i];
                                       if (line.type === 'unchanged') {
                                           sbsRows.push({ leftNum: lLine++, leftCode: line.value, leftType: 'unchanged', rightNum: rLine++, rightCode: line.value, rightType: 'unchanged' });
                                       } else if (line.type === 'removed') {
                                           if (i + 1 < diffLines.length && diffLines[i+1].type === 'added') {
                                               sbsRows.push({ leftNum: lLine++, leftCode: line.value, leftType: 'removed', rightNum: rLine++, rightCode: diffLines[i+1].value, rightType: 'added' });
                                               i++; 
                                           } else {
                                               sbsRows.push({ leftNum: lLine++, leftCode: line.value, leftType: 'removed', rightNum: null, rightCode: '', rightType: 'empty' });
                                           }
                                       } else if (line.type === 'added') {
                                           sbsRows.push({ leftNum: null, leftCode: '', leftType: 'empty', rightNum: rLine++, rightCode: line.value, rightType: 'added' });
                                       }
                                   }
                               }

                               return (
                                   <div key={idx} className="bg-[#0d1117] border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                                        <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
                                            <span className="text-[13px] font-bold text-zinc-300 flex items-center gap-2"><File size={16} className="text-indigo-400"/> {art.filename}</span>
                                            {isNew ? <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded font-medium border border-emerald-400/20">New File</span> :
                                             isUnchanged ? <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded font-medium border border-zinc-700">Unchanged</span> :
                                             <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded font-medium border border-amber-400/20">Modified</span>}
                                        </div>

                                        <div className="overflow-x-auto w-full bg-[#0d1117]">
                                            {oldArt && !isUnchanged ? (
                                                <div className="flex w-full min-w-max text-[12px] font-mono leading-relaxed divide-x divide-zinc-800">
                                                    <div className="w-1/2 flex flex-col pb-4">
                                                        <div className="sticky top-0 bg-[#2a1315]/90 text-red-400/80 text-[10px] uppercase tracking-widest px-4 py-2 border-b border-zinc-800/50 backdrop-blur-md z-10 font-sans">Main Branch (Old)</div>
                                                        <div className="pt-2">
                                                            {sbsRows.map((r, i) => (
                                                                <div key={`l-${i}`} className={`flex px-2 hover:bg-zinc-800/30 ${r.leftType === 'removed' ? 'bg-red-900/30 text-red-300' : 'text-zinc-400'} ${r.leftType === 'empty' ? 'bg-[#0d1117] select-none' : ''}`}>
                                                                    <span className="w-10 shrink-0 text-zinc-600 text-right pr-4 select-none opacity-50">{r.leftNum || ''}</span>
                                                                    <span className="whitespace-pre">{r.leftCode}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="w-1/2 flex flex-col pb-4">
                                                        <div className="sticky top-0 bg-[#102a1b]/90 text-emerald-400/80 text-[10px] uppercase tracking-widest px-4 py-2 border-b border-zinc-800/50 backdrop-blur-md z-10 font-sans">This Timeline (New)</div>
                                                        <div className="pt-2">
                                                            {sbsRows.map((r, i) => (
                                                                <div key={`r-${i}`} className={`flex px-2 hover:bg-zinc-800/30 ${r.rightType === 'added' ? 'bg-emerald-900/30 text-emerald-300' : 'text-zinc-300'} ${r.rightType === 'empty' ? 'bg-[#0d1117] select-none' : ''}`}>
                                                                    <span className="w-10 shrink-0 text-zinc-600 text-right pr-4 select-none opacity-50">{r.rightNum || ''}</span>
                                                                    <span className="whitespace-pre">{r.rightCode}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={`p-4 font-mono text-[12px] text-zinc-300 whitespace-pre ${isNew ? "bg-[#102a1b]/10" : ""}`}>
                                                    {art.code}
                                                </div>
                                            )}
                                        </div>
                                   </div>
                               );
                            })}
                         </div>
                      )}
                   </div>
               )}
            </div>
            <div className="p-5 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
               <button onClick={() => setPrModalOpen(false)} className="px-5 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 font-medium transition-colors">Cancel</button>
               <button onClick={confirmMerge} disabled={loading || isDiffLoading} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin"/> : <GitMerge size={16} />} Squash and Merge
               </button>
            </div>
          </div>
        </div>
      )}

      <aside className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-950/50 z-10">
        <div className="p-4 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><div className="bg-indigo-600 p-1.5 rounded-lg"><GitBranch size={18} className="text-white" /></div><h1 className="font-bold text-md tracking-tight">DialogTree</h1></div>
          <button onClick={copyShareLink} className="text-zinc-500 hover:text-indigo-400 transition-colors" title="Invite Collaborators"><Share2 size={16} /></button>
        </div>
        <div className="px-4 mb-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-zinc-800 p-1.5 rounded-md"><User size={16} className="text-indigo-400"/></div>
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-300">{session.user.user_metadata?.full_name || session.user.email.split('@')[0]}</div>
                    <div className="truncate text-xs text-zinc-500">{session.user.email}</div>
                </div>
            </div>
            <button onClick={handleLogout} className="text-zinc-500 hover:text-red-400 transition-colors shrink-0 ml-2"><LogOut size={16} /></button>
          </div>
        </div>
        <nav className="flex-1 px-3 overflow-y-auto">
          <div className="text-xs font-semibold text-zinc-500 mb-3 px-2 uppercase tracking-wider">Timelines</div>
          {branches.length === 0 ? (<div className="px-2 text-zinc-600 text-sm italic">Loading branches...</div>) : (
            <div className="relative space-y-1 pb-4">
               {branches.map((b) => {
                 const depth = getBranchDepth(b);
                 return (
                   <div key={b.id} className="relative flex items-center group" style={{ paddingLeft: `${depth * 16}px` }}>
                     {depth > 0 && <div className="absolute w-3 border-t border-zinc-700" style={{ left: `${(depth * 16) - 10}px` }}></div>}
                     <button 
                       onClick={() => setActiveBranch(b)} 
                       className={`flex-1 flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeBranch?.id === b.id ? 'bg-zinc-800 text-indigo-400 border border-zinc-700' : 'hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}
                     >
                       <div className="flex items-center gap-2 truncate pr-2">
                           {b.is_ephemeral ? <Zap size={14} className="text-amber-400 shrink-0" /> : <GitBranch size={14} className="shrink-0" />}
                           <span className="truncate">{b.name}</span>
                       </div>
                       {b.name !== 'main' && (
                           <Trash2 size={14} onClick={(e) => deleteBranch(b.id, e)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                       )}
                     </button>
                   </div>
                 );
               })}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 bg-zinc-950">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-3">
             <span className="text-sm font-medium text-zinc-400">active:</span>
             <code className="bg-zinc-900 px-3 py-1 rounded-md text-xs text-indigo-300 border border-zinc-700 flex items-center gap-2">{activeBranch?.is_ephemeral && <Zap size={12} className="text-amber-400"/>}{activeBranch?.name || 'loading...'}</code>
          </div>
          <div className="flex items-center gap-3">
            
            <div className="relative">
               <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-900 transition-all text-xs font-medium" title="Export this timeline">
                  <DownloadCloud size={14} /> Export <ChevronDown size={12} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`}/>
               </button>
               {exportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 z-50">
                     <button onClick={exportMD} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex flex-col">
                        <span className="font-semibold">Markdown (.md)</span>
                        <span className="text-[10px] text-zinc-500">For GitHub or Obsidian</span>
                     </button>
                     <div className="h-px bg-zinc-800 my-1"></div>
                     <button onClick={exportPDF} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex flex-col">
                        <span className="font-semibold">Print / PDF</span>
                        <span className="text-[10px] text-zinc-500">Perfectly formatted document</span>
                     </button>
                  </div>
               )}
            </div>

            <button onClick={() => setIsArtifactSidebarOpen(!isArtifactSidebarOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${isArtifactSidebarOpen || timelineArtifacts.length > 0 ? 'border-indigo-600/50 bg-indigo-900/20 text-indigo-300 hover:bg-indigo-900/40' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
               <Library size={14} /> Artifacts ({timelineArtifacts.length})
            </button>

            {activeBranch?.is_ephemeral && (<button onClick={makePermanent} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700 hover:bg-amber-900/50 text-amber-300 text-xs font-medium transition-all"><Save size={14} /> Make Permanent</button>)}
            
            <button onClick={initiateMerge} className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-emerald-900/50 hover:bg-emerald-900/20 text-xs font-medium transition-all text-emerald-400 bg-zinc-900 shadow-sm"><GitMerge size={14} /> Merge Request</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth min-h-0" onClick={() => setExportMenuOpen(false)}>
          {switching ? (<div className="flex justify-center mt-20"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>) : messages.length === 0 ? (<div className="text-center mt-20 text-zinc-500">Start typing...</div>) : (
            messages.map((m, i) => {
              const displayContent = m.content.replace(/---START_ATTACHMENT:(.*?)---[\s\S]*?---END_ATTACHMENT---/g, '\n\n📎 **Attached Document:** `$1`');
              return (
              <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : m.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                <div className={`p-5 rounded-2xl max-w-[85%] shadow-sm relative group min-w-0 ${m.role === 'user' ? 'bg-zinc-800 text-zinc-100' : m.role === 'system' ? 'bg-zinc-900/80 border border-zinc-700 text-zinc-300 rounded-lg w-full text-center text-xs font-mono tracking-wide shadow-md' : 'bg-transparent text-zinc-200'}`}>
                  {m.role === 'user' ? (
                    <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed prose prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{displayContent}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-[15px] leading-relaxed break-words overflow-hidden">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{displayContent}</ReactMarkdown>
                    </div>
                  )}
                  {m.id && m.id !== 'temp' && m.role !== 'system' && (
                    <button onClick={() => setForkModal({ isOpen: true, messageId: m.id, name: "", isEphemeral: true })} className={`absolute -bottom-4 ${m.role === 'user' ? '-left-2' : '-right-2'} p-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-full opacity-0 group-hover:opacity-100 hover:text-indigo-400 hover:border-indigo-500 transition-all shadow-lg z-10`} title="Branch timeline from this message"><GitFork size={14} /></button>
                  )}
                </div>
              </div>
            )})
          )}
          {loading && (<div className="flex gap-3 items-center text-zinc-400 text-sm bg-zinc-900/50 w-max px-4 py-2 rounded-full border border-zinc-800/50"><Loader2 size={16} className="animate-spin text-indigo-500" /> <span>AI is thinking...</span></div>)}
        </div>

        <div className="p-6 pt-2 shrink-0" onClick={() => setExportMenuOpen(false)}>
          <div className="max-w-4xl mx-auto relative group flex items-end gap-3 bg-zinc-900 border border-zinc-800 rounded-3xl p-2 shadow-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
            <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.md,.js,.ts,.py,.json,.html,.css,.csv,.pdf,image/*" />
            <button onClick={() => fileInputRef.current?.click()} className="p-3.5 bg-zinc-800/50 rounded-2xl text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition-all mb-1"><Paperclip size={20} /></button>
            <div className="relative flex-1 flex flex-col justify-end min-w-0">
              {selectedFiles.length > 0 && (
                 <div className="flex flex-wrap gap-2 mb-3">
                    {selectedFiles.map((file, idx) => (
                      file.type.startsWith('image/') ? (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 shadow-md group">
                           <img src={file.base64} alt="preview" className="w-full h-full object-cover" />
                           <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/60 text-zinc-300 hover:text-red-400 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                        </div>
                      ) : (
                        <div key={idx} className="bg-zinc-800 rounded-lg py-1.5 px-3 flex items-center gap-2 border border-zinc-700 shadow-md">
                          <File size={14} className="text-indigo-400 shrink-0" />
                          <span className="text-xs text-zinc-300 max-w-[120px] truncate">{file.name}</span>
                          <button onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-500 hover:text-red-400"><X size={14}/></button>
                        </div>
                      )
                    ))}
                 </div>
              )}
              <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} disabled={switching || !activeBranch} placeholder={`Message #${activeBranch?.name || '...'}`} className="w-full bg-transparent border-none py-3 px-2 focus:outline-none focus:ring-0 text-[15px] resize-none overflow-y-auto" style={{ minHeight: '50px', maxHeight: '200px', height: input ? 'auto' : '50px' }} />
            </div>
            <button onClick={handleSend} disabled={loading || switching || (!input.trim() && selectedFiles.length === 0)} className="p-3.5 mb-1 bg-indigo-600 rounded-2xl hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 transition-all active:scale-95 shrink-0"><Send size={18} className={(input.trim() || selectedFiles.length > 0) ? "text-white" : "text-zinc-400"} /></button>
          </div>
        </div>
      </main>

      {/* ARTIFACT LIBRARY SIDEBAR */}
      {isArtifactSidebarOpen && (
         <aside className="w-64 border-l border-zinc-800 bg-zinc-950/90 backdrop-blur-md flex flex-col shadow-2xl z-20">
            <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
               <div className="flex items-center gap-2 text-zinc-200 font-semibold text-sm"><Library size={16} className="text-indigo-400" /> Artifact Library</div>
               <button onClick={() => setIsArtifactSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
               {timelineArtifacts.length === 0 ? (
                  <div className="text-xs text-zinc-600 text-center mt-10 italic">No code generated in this timeline yet.</div>
               ) : (
                  timelineArtifacts.map((art, idx) => (
                     <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-indigo-500/50 transition-colors group cursor-pointer" onClick={() => setActiveArtifact({ code: art.code, lang: art.lang, filename: art.filename })}>
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-bold text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 truncate max-w-[150px]" title={art.filename}>{art.filename}</span>
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); downloadCode(art.code, art.filename); }} className="text-zinc-400 hover:text-zinc-200 text-xs"><Download size={12}/></button>
                           </div>
                        </div>
                        <div className="text-[10px] uppercase text-zinc-500 mb-1">{art.lang}</div>
                        <div className="text-xs text-zinc-400 max-h-32 overflow-y-auto font-mono bg-zinc-950 p-2 rounded border border-zinc-800/50">{art.code}</div>
                     </div>
                  ))
               )}
            </div>
         </aside>
      )}

      {/* ARTIFACT VIEWER (SPLIT SCREEN) */}
      {activeArtifact && (
        <aside className="w-[45%] min-w-[400px] border-l border-zinc-800 bg-zinc-950 flex flex-col shadow-2xl z-30 absolute right-0 top-0 bottom-0">
            <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900">
                <div className="flex items-center gap-2 overflow-hidden pr-4">
                    <Code size={18} className="text-indigo-400 shrink-0"/>
                    <span className="text-sm font-semibold text-zinc-200 truncate">{activeArtifact.filename}</span>
                    <span className="ml-2 text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">{activeArtifact.lang}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => downloadCode(activeArtifact.code, activeArtifact.filename)} className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"><Download size={14}/> Download</button>
                    <button onClick={() => navigator.clipboard.writeText(activeArtifact.code)} className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors">Copy</button>
                    <button onClick={() => setActiveArtifact(null)} className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"><X size={18}/></button>
                </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-[#0d1117]">
                <pre className="text-[13px] font-mono text-zinc-300 whitespace-pre">{activeArtifact.code}</pre>
            </div>
        </aside>
      )}

    </div>
  );
}