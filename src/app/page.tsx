"use client";
import React, { useState, useEffect } from 'react';
import { GitBranch, GitMerge, Send, Plus, Zap, Loader2, MessageSquare, GitFork, X, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '@/lib/api';

export default function DialogTreeHome() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  
  const [workspace, setWorkspace] = useState<any>(null);
  const [activeBranch, setActiveBranch] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  // Modal State
  const [forkModal, setForkModal] = useState({ isOpen: false, messageId: null as string | null, name: "", isEphemeral: true });

  useEffect(() => {
    const setup = async () => {
      try {
        const data = await api.init("550e8400-e29b-41d4-a716-446655440000", "My First Workspace");
        setWorkspace(data.workspace);
        setActiveBranch(data.branch);

        const branchData = await api.getBranches(data.workspace.id);
        setBranches(branchData.branches);
      } catch (err) {
        console.error("Setup failed:", err);
      }
    };
    setup();
  }, []);

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

  const handleSend = async () => {
    if (!input.trim() || !activeBranch) return;

    const userPrompt = input;
    setInput("");
    setLoading(true);

    const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
    
    setMessages(prev => [...prev, { role: 'user', content: userPrompt, id: 'temp' }]);

    try {
      const data = await api.chat(activeBranch.id, userPrompt, lastMsgId);
      if (data.error) throw new Error(data.error);

      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'temp');
        return [...filtered, 
          { id: data.userMessageId, role: 'user', content: userPrompt }, 
          { id: data.aiMessageId, role: 'ai', content: data.aiResponse }
        ];
      });
    } catch (err: any) {
      console.error("Chat failed:", err);
      setMessages(prev => prev.filter(m => m.id !== 'temp'));
      alert(`Failed to get AI response: \n\n${err.message || "Server is busy."}`);
    } finally {
      setLoading(false);
    }
  };

  const openForkModal = (messageId: string) => {
    setForkModal({ isOpen: true, messageId, name: "", isEphemeral: true });
  };

  const submitFork = async () => {
    if (!forkModal.name.trim() || !forkModal.messageId) return;

    setLoading(true);
    setForkModal(prev => ({ ...prev, isOpen: false })); // close modal
    try {
      const data = await api.branch(workspace.id, forkModal.name, forkModal.isEphemeral);
      
      const targetIndex = messages.findIndex(m => m.id === forkModal.messageId);
      const slicedMessages = messages.slice(0, targetIndex + 1);
      
      setBranches(prev => [...prev, data.branch]);
      setMessages(slicedMessages);
      setActiveBranch(data.branch);
      
    } catch (err) {
      console.error("Fork failed:", err);
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

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans relative">
      
      {/* Fork Modal Overlay */}
      {forkModal.isOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><GitFork size={20} className="text-indigo-400"/> Diverge Timeline</h2>
              <button onClick={() => setForkModal(prev => ({ ...prev, isOpen: false }))} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            
            <input 
              type="text" 
              autoFocus
              placeholder="Name this timeline..." 
              value={forkModal.name}
              onChange={e => setForkModal(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && submitFork()}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-100 mb-4 focus:outline-none focus:border-indigo-500"
            />

            <div className="flex items-center gap-3 mb-6 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
              <input 
                type="checkbox" 
                id="ephemeral"
                checked={forkModal.isEphemeral}
                onChange={e => setForkModal(prev => ({ ...prev, isEphemeral: e.target.checked }))}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-zinc-900"
              />
              <label htmlFor="ephemeral" className="text-sm text-zinc-300 flex items-center gap-2 cursor-pointer">
                <Zap size={14} className={forkModal.isEphemeral ? "text-amber-400" : "text-zinc-600"}/> 
                Temporary Workspace (Ephemeral)
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setForkModal(prev => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button onClick={submitFork} disabled={!forkModal.name.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all">Create Branch</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col">
        <div className="p-4 flex items-center gap-2 mb-4">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <GitBranch size={20} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">DialogTree</h1>
        </div>

        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          <div className="text-xs font-semibold text-zinc-500 mb-3 px-2 uppercase tracking-wider">Timelines</div>
          {branches.length === 0 ? (
             <div className="px-2 text-zinc-600 text-sm italic">Loading branches...</div>
          ) : (
            branches.map((b) => (
              <button 
                key={b.id}
                onClick={() => setActiveBranch(b)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeBranch?.id === b.id 
                  ? 'bg-zinc-800 text-indigo-400' 
                  : 'hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {b.is_ephemeral ? <Zap size={16} className="text-amber-400" /> : <GitBranch size={16} />}
                {b.name}
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
             <span className="text-sm font-medium text-zinc-400">active timeline:</span>
             <code className="bg-zinc-900 px-3 py-1 rounded-md text-xs text-indigo-300 border border-zinc-700 flex items-center gap-2">
               {activeBranch?.is_ephemeral && <Zap size={12} className="text-amber-400"/>}
               {activeBranch?.name || 'loading...'}
             </code>
          </div>
          <div className="flex items-center gap-3">
            {activeBranch?.is_ephemeral && (
              <button onClick={makePermanent} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700 hover:bg-amber-900/50 text-amber-300 text-xs font-medium transition-all">
                <Save size={14} /> Make Permanent
              </button>
            )}
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-900 text-xs font-medium transition-all text-zinc-300">
              <GitMerge size={14} /> Merge Request
            </button>
          </div>
        </header>

        {/* Dynamic Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
          {switching ? (
             <div className="max-w-2xl mx-auto text-center mt-20 flex flex-col items-center gap-3 text-zinc-500">
               <Loader2 size={24} className="animate-spin text-indigo-500" />
               <p className="text-sm">Loading timeline history...</p>
             </div>
          ) : messages.length === 0 ? (
            <div className="max-w-2xl mx-auto text-center mt-20 flex flex-col items-center gap-4 opacity-50">
              <MessageSquare size={48} className="text-zinc-700" />
              <p className="text-zinc-400 text-sm">No messages in this branch yet. Start typing...</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`max-w-3xl mx-auto flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                
                <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm relative group ${
                  m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-sm' 
                  : m.role === 'system'
                  ? 'bg-amber-900/30 border border-amber-700/50 text-amber-200 rounded-lg w-full text-center text-xs uppercase tracking-widest font-semibold'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm'
                }`}>
                  
                  {/* Markdown Renderer for AI, Plain text for User */}
                  {m.role === 'user' ? (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="prose prose-invert max-w-none text-[15px] prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  
                  {/* Fork Button */}
                  {m.id && m.id !== 'temp' && (
                    <button
                      onClick={() => openForkModal(m.id)}
                      className={`absolute -bottom-3 ${m.role === 'user' ? '-left-3' : '-right-3'} p-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg opacity-0 group-hover:opacity-100 hover:text-indigo-400 hover:border-indigo-500 transition-all shadow-lg z-10`}
                      title="Branch timeline from this message"
                    >
                      <GitFork size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          
          {loading && (
            <div className="max-w-3xl mx-auto flex gap-3 items-center text-zinc-400 text-sm bg-zinc-900/50 w-max px-4 py-2 rounded-full border border-zinc-800/50">
              <Loader2 size={16} className="animate-spin text-indigo-500" /> 
              <span>AI is thinking...</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 pt-2 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent">
          <div className="max-w-3xl mx-auto relative group">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={switching || !activeBranch}
              placeholder={`Message in #${activeBranch?.name || '...'}`}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg disabled:opacity-50 transition-all text-[15px]"
            />
            <button 
              onClick={handleSend}
              disabled={loading || switching || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 transition-all active:scale-95"
            >
              <Send size={18} className={input.trim() ? "text-white" : "text-zinc-400"} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}