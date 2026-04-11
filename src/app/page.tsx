"use client";
import React, { useState, useEffect, useRef } from 'react';
import { GitBranch, GitMerge, Send, Plus, Zap, Loader2, MessageSquare, GitFork, X, Save, Paperclip, DownloadCloud, LogOut, Code, Globe, File } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function DialogTreeHome() {
  const [session, setSession] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<{name: string, content: string, ext: string} | null>(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [workspace, setWorkspace] = useState<any>(null);
  const [activeBranch, setActiveBranch] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const [forkModal, setForkModal] = useState({ isOpen: false, messageId: null as string | null, name: "", isEphemeral: true });
  const [importModal, setImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const setup = async () => {
      try {
        const data = await api.init(session.user.id, "My First Workspace");
        if (!data.workspace) return;
        setWorkspace(data.workspace);
        setActiveBranch(data.branch);
        const branchData = await api.getBranches(data.workspace.id);
        setBranches(branchData.branches);
      } catch (err) {
        console.error("Setup failed:", err);
      }
    };
    setup();
  }, [session]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!activeBranch) return;
      setSwitching(true);
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert('Account created! Welcome to DialogTree.');
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

  const handleOAuth = async (provider: 'google' | 'github') => {
    await supabase.auth.signInWithOAuth({ provider });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setWorkspace(null);
    setActiveBranch(null);
    setMessages([]);
  };

  const handleSend = async () => {
    let finalPrompt = input.trim();
    if (selectedFile) {
        finalPrompt += `\n\n[Attached File: ${selectedFile.name}]\n\`\`\`${selectedFile.ext}\n${selectedFile.content}\n\`\`\``;
    }

    if (!finalPrompt || !activeBranch) return;

    setInput("");
    setSelectedFile(null);
    setLoading(true);

    const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
    setMessages(prev => [...prev, { role: 'user', content: finalPrompt, id: 'temp' }]);

    try {
      // ARCHITECTURE UPGRADE: Passing 'messages' array directly to the API
      const data = await api.chat(activeBranch.id, finalPrompt, lastMsgId, messages);
      
      if (data.error) throw new Error(data.error);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'temp');
        return [...filtered, { id: data.userMessageId, role: 'user', content: finalPrompt }, { id: data.aiMessageId, role: 'ai', content: data.aiResponse }];
      });
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== 'temp'));
      alert(`Failed to get AI response: \n\n${err.message || "Server is busy."}`);
    } finally {
      setLoading(false);
    }
  };

  const submitFork = async () => {
    if (!forkModal.name.trim() || !forkModal.messageId) return;
    setLoading(true);
    setForkModal(prev => ({ ...prev, isOpen: false })); 
    try {
      const data = await api.branch(workspace.id, forkModal.name, forkModal.isEphemeral, forkModal.messageId);
      const targetIndex = messages.findIndex(m => m.id === forkModal.messageId);
      const slicedMessages = messages.slice(0, targetIndex + 1);
      
      const systemCommit = { role: 'system', content: `🌱 Timeline diverged: #${data.branch.name}`, id: data.systemMsgId };
      
      setBranches(prev => [...prev, data.branch]);
      setMessages([...slicedMessages, systemCommit]);
      setActiveBranch(data.branch);
    } catch (err) {
      alert("Failed to create new timeline.");
    } finally {
      setLoading(false);
    }
  };

  const makePermanent = async () => {
    if (!activeBranch) return;
    try {
      const data = await api.toggleEphemeral(activeBranch.id);
      setActiveBranch(data.branch);
      setBranches(prev => prev.map(b => b.id === data.branch.id ? data.branch : b));
    } catch (err) {
      console.error("Failed to make permanent", err);
    }
  };

  const handleMerge = async () => {
    if (!activeBranch || activeBranch.name === 'main') {
      alert("You are already in the main timeline!");
      return;
    }
    const mainBranch = branches.find(b => b.name === 'main');
    const latestSourceMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (!mainBranch || !latestSourceMsgId) return;

    setLoading(true);
    try {
      // ARCHITECTURE UPGRADE: Passing 'messages' array directly to the merge function
      const res = await api.merge(activeBranch.id, mainBranch.id, latestSourceMsgId, null, messages);
      
      if(res.error) throw new Error(res.error);
      alert("Branch merged successfully! Jumping back to main timeline.");
      setActiveBranch(mainBranch); 
    } catch(e: any) {
      alert(`Merge failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) { 
      alert("File too large. Please upload text/code files under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const ext = file.name.split('.').pop() || 'text';
      setSelectedFile({ name: file.name, content, ext });
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const handleImport = () => {
    alert(`This will send ${importUrl} to your future Scraper Microservice!`);
    setImportModal(false);
    setImportUrl("");
  };

  // ==========================================
  // RENDER: LOGIN
  // ==========================================
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
              <div><label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="engineer@example.com" /></div>
              <div><label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="••••••••" /></div>
              <button type="submit" disabled={authLoading} className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2 mt-4">{authLoading ? <Loader2 size={18} className="animate-spin text-zinc-500" /> : null}{isSignUp ? 'Create Account' : 'Sign In'}</button>
            </form>
            <div className="mt-8 text-center"><button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-zinc-500 hover:text-indigo-400 transition-colors">{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}</button></div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: MAIN APP
  // ==========================================
  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans relative">
      {importModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><DownloadCloud size={20} className="text-indigo-400"/> Import Shared Chat</h2><button onClick={() => setImportModal(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button></div>
            <p className="text-sm text-zinc-400 mb-4">Paste a public link from ChatGPT or Gemini to inject it into a new timeline.</p>
            <input type="text" placeholder="https://chatgpt.com/share/..." value={importUrl} onChange={e => setImportUrl(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 mb-6 focus:outline-none focus:border-indigo-500" />
            <div className="flex justify-end gap-3"><button onClick={() => setImportModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button><button onClick={handleImport} disabled={!importUrl} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">Run Importer</button></div>
          </div>
        </div>
      )}
      {forkModal.isOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2"><GitFork size={20} className="text-indigo-400"/> Diverge Timeline</h2><button onClick={() => setForkModal(prev => ({ ...prev, isOpen: false }))} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button></div>
            <input type="text" autoFocus placeholder="Name this timeline..." value={forkModal.name} onChange={e => setForkModal(prev => ({ ...prev, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && submitFork()} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 mb-4 focus:outline-none focus:border-indigo-500" />
            <div className="flex items-center gap-3 mb-6 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
              <input type="checkbox" id="ephemeral" checked={forkModal.isEphemeral} onChange={e => setForkModal(prev => ({ ...prev, isEphemeral: e.target.checked }))} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-zinc-900" />
              <label htmlFor="ephemeral" className="text-sm text-zinc-300 flex items-center gap-2 cursor-pointer"><Zap size={14} className={forkModal.isEphemeral ? "text-amber-400" : "text-zinc-600"}/> Temporary Workspace (Ephemeral)</label>
            </div>
            <div className="flex justify-end gap-3"><button onClick={() => setForkModal(prev => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button><button onClick={submitFork} disabled={!forkModal.name.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">Create Branch</button></div>
          </div>
        </div>
      )}

      <aside className="w-64 border-r border-zinc-800 flex flex-col">
        <div className="p-4 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><div className="bg-indigo-600 p-1.5 rounded-lg"><GitBranch size={18} className="text-white" /></div><h1 className="font-bold text-md tracking-tight">DialogTree</h1></div>
        </div>
        <div className="px-4 mb-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 flex items-center justify-between">
            <div className="truncate text-xs text-zinc-400">{session.user.email}</div>
            <button onClick={handleLogout} className="text-zinc-500 hover:text-red-400 transition-colors" title="Logout"><LogOut size={14} /></button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          <div className="text-xs font-semibold text-zinc-500 mb-3 px-2 uppercase tracking-wider">Timelines</div>
          {branches.length === 0 ? (<div className="px-2 text-zinc-600 text-sm italic">Loading branches...</div>) : (
            branches.map((b) => (
              <button key={b.id} onClick={() => setActiveBranch(b)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeBranch?.id === b.id ? 'bg-zinc-800 text-indigo-400' : 'hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}>
                {b.is_ephemeral ? <Zap size={16} className="text-amber-400" /> : <GitBranch size={16} />}
                {b.name}
              </button>
            ))
          )}
        </nav>
        <div className="p-4 border-t border-zinc-800 flex flex-col gap-2">
          <button onClick={() => setImportModal(true)} className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm font-semibold transition-all text-zinc-300"><DownloadCloud size={16} /> Import Chat</button>
          <button className="flex items-center justify-center gap-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-semibold transition-all"><Plus size={16} /> New Workspace</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
             <span className="text-sm font-medium text-zinc-400">active timeline:</span>
             <code className="bg-zinc-900 px-3 py-1 rounded-md text-xs text-indigo-300 border border-zinc-700 flex items-center gap-2">{activeBranch?.is_ephemeral && <Zap size={12} className="text-amber-400"/>}{activeBranch?.name || 'loading...'}</code>
          </div>
          <div className="flex items-center gap-3">
            {activeBranch?.is_ephemeral && (<button onClick={makePermanent} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700 hover:bg-amber-900/50 text-amber-300 text-xs font-medium transition-all"><Save size={14} /> Make Permanent</button>)}
            <button onClick={handleMerge} className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-900 text-xs font-medium transition-all text-zinc-300"><GitMerge size={14} /> Merge Request</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {switching ? (<div className="max-w-2xl mx-auto text-center mt-20 flex flex-col items-center gap-3 text-zinc-500"><Loader2 size={24} className="animate-spin text-indigo-500" /><p className="text-sm">Loading timeline history...</p></div>) : messages.length === 0 ? (<div className="max-w-2xl mx-auto text-center mt-20 flex flex-col items-center gap-4 opacity-50"><MessageSquare size={48} className="text-zinc-700" /><p className="text-zinc-400 text-sm">No messages in this branch yet. Start typing...</p></div>) : (
            messages.map((m, i) => (
              <div key={i} className={`max-w-3xl mx-auto flex gap-4 ${m.role === 'user' ? 'justify-end' : m.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm relative group ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : m.role === 'system' ? 'bg-zinc-900/50 border border-zinc-800 text-zinc-400 rounded-lg w-full text-center text-xs font-mono tracking-wide' : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'}`}>
                  {m.role === 'user' ? (
                    <div className="prose prose-invert max-w-none text-[15px] prose-p:leading-relaxed prose-pre:bg-zinc-900/50 prose-pre:border prose-pre:border-indigo-400/30">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-[15px] prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  )}
                  {m.id && m.id !== 'temp' && m.role !== 'system' && (
                    <button onClick={() => setForkModal({ isOpen: true, messageId: m.id, name: "", isEphemeral: true })} className={`absolute -bottom-3 ${m.role === 'user' ? '-left-3' : '-right-3'} p-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg opacity-0 group-hover:opacity-100 hover:text-indigo-400 hover:border-indigo-500 transition-all shadow-lg z-10`} title="Branch timeline from this message"><GitFork size={16} /></button>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (<div className="max-w-3xl mx-auto flex gap-3 items-center text-zinc-400 text-sm bg-zinc-900/50 w-max px-4 py-2 rounded-full border border-zinc-800/50"><Loader2 size={16} className="animate-spin text-indigo-500" /> <span>AI is thinking...</span></div>)}
        </div>

        <div className="p-6 pt-2 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
          <div className="max-w-3xl mx-auto relative group flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.md,.js,.ts,.py,.json,.html,.css,.csv" />
            <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-indigo-400 hover:border-indigo-500 transition-all" title="Attach text or code file">
              <Paperclip size={20} />
            </button>
            <div className="relative flex-1 flex flex-col justify-end">
              {selectedFile && (
                 <div className="absolute bottom-full mb-2 left-0 max-w-xs bg-zinc-800 rounded-lg p-2 flex items-center justify-between border border-zinc-700 shadow-md z-20">
                    <div className="flex items-center gap-2 overflow-hidden mr-4">
                       <File size={16} className="text-indigo-400 shrink-0" />
                       <span className="text-sm text-zinc-300 truncate">{selectedFile.name}</span>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-700"><X size={14}/></button>
                 </div>
              )}
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={switching || !activeBranch}
                placeholder={`Message in #${activeBranch?.name || '...'} (Shift+Enter for new line)`}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg disabled:opacity-50 transition-all text-[15px] resize-none h-[56px] min-h-[56px] max-h-[200px] overflow-y-auto"
                style={{ height: input ? 'auto' : '56px' }}
              />
              <button onClick={handleSend} disabled={loading || switching || (!input.trim() && !selectedFile)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 transition-all active:scale-95">
                <Send size={18} className={(input.trim() || selectedFile) ? "text-white" : "text-zinc-400"} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}