"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GitBranch, GitMerge, Send, Zap, Loader2, GitFork, X, Save, Paperclip, LogOut, Code, Globe, File, CheckCircle, MessageCircle, Share, Download, Trash, User as UserIcon, Library, Cloud, ChevronDown, GitCommit, Folder, Plus, Play, Sparkles, Bug, Import, ChevronRight, AlertTriangle, CheckCircle2, RotateCcw, Settings, Cpu, Server, Database, Activity, Shield } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast, { Toaster } from 'react-hot-toast'; // 🔥 NEW: Pro Notifications

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { User, Workspace, Branch, Message, Artifact } from '@/types'; // 🔥 NEW: Strict Typing

import Editor, { useMonaco } from "@monaco-editor/react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { getBranchDepth, downloadCode, downloadAllArtifacts, extractAllArtifacts, exportMD, exportPDF } from '@/lib/dialogUtils';
import MergeRequestModal from '@/components/MergeRequestModal';
import FolderTreeItem from '@/components/FolderTree';
import PreviewEngine from '@/components/PreviewEngine';
import MultiplayerCursors from '@/components/MultiplayerCursors';

export default function DialogTreeHome() {
  const monaco = useMonaco();
  const [session, setSession] = useState<{ user: User } | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [repoFiles, setRepoFiles] = useState<{content: string, language: string, filename: string}[]>([]);
  
  const [input, setInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<{name: string, base64: string, type: string, ext: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<Workspace[]>([]);

  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editWsName, setEditWsName] = useState("");
  const [undoToast, setUndoToast] = useState<{ id: string, name: string, timer?: NodeJS.Timeout } | null>(null);

  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [editorTab, setEditorTab] = useState<'code' | 'preview'>('code');
  const [editorWidth, setEditorWidth] = useState(45); 
  
  const [editorSelection, setEditorSelection] = useState("");
  const [copilotInput, setCopilotInput] = useState("");
  const [editorErrors, setEditorErrors] = useState<any[]>([]);

  // Modals & Github State
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [githubRepo, setGithubRepo] = useState("");
  const [githubCommitMsg, setGithubCommitMsg] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [githubPushAll, setGithubPushAll] = useState(true); 
  const [githubPushing, setGithubPushing] = useState(false);

  const [deploySettingsOpen, setDeploySettingsOpen] = useState(false);
  const [vercelToken, setVercelToken] = useState("");
  const [renderToken, setRenderToken] = useState("");
  const [supabaseToken, setSupabaseToken] = useState("");
  
  const [deployStatus, setDeployStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [pipelineTasks, setPipelineTasks] = useState<{label: string, status: 'pending'|'active'|'done'}[]>([]);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'input' | 'select'>('input');
  const [repoTree, setRepoTree] = useState<any[]>([]);
  const [folderStructure, setFolderStructure] = useState<any>({});
  const [selectedTreeFiles, setSelectedTreeFiles] = useState<Set<string>>(new Set());
  const [githubImporting, setGithubImporting] = useState(false);

  const [isArtifactSidebarOpen, setIsArtifactSidebarOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isChitchatOpen, setIsChitchatOpen] = useState(false);
  const [chitchatInput, setChitchatInput] = useState("");
  const [chitchatMsgs, setChitchatMsgs] = useState<any[]>([]);

  const [forkModal, setForkModal] = useState({ isOpen: false, messageId: null as string | null, name: "", isEphemeral: true });
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [mainArtifacts, setMainArtifacts] = useState<Artifact[]>([]);
  const [isDiffLoading, setIsDiffLoading] = useState(false);

  const [aiModeMenuOpen, setAiModeMenuOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'standard' | 'deepthink' | 'orchestrate' | 'agent'>('standard');

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const timelineArtifacts = extractAllArtifacts(messages);
  const allArtifacts = [...repoFiles.map(f => ({ code: f.content, lang: f.language, filename: f.filename }))];
  
  timelineArtifacts.forEach(art => {
      const existingIdx = allArtifacts.findIndex(a => a.filename === art.filename);
      if (existingIdx >= 0) allArtifacts[existingIdx] = art; 
      else allArtifacts.push(art); 
  });

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
      monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
      editor.onDidChangeCursorSelection((e: any) => {
          const selection = editor.getModel().getValueInRange(e.selection);
          if (selection.trim().length > 0) setEditorSelection(selection); else setEditorSelection("");
      });
      monacoInstance.editor.onDidChangeMarkers(() => {
          const markers = monacoInstance.editor.getModelMarkers({ resource: editor.getModel().uri });
          setEditorErrors(markers.filter((m: any) => m.severity === 8));
      });
  };

  const handleAutoFix = () => {
      if (editorErrors.length === 0 || !activeArtifact) return;
      const errorText = editorErrors.map(e => `Line ${e.startLineNumber}: ${e.message}`).join('\n');
      handleSend(`I have syntax errors in \`${activeArtifact.filename}\`.\n\nErrors:\n${errorText}\n\nPlease fix the code.`);
  };

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    const startWidth = editorWidth;
    const startPos = mouseDownEvent.clientX;
    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
        const diff = startPos - mouseMoveEvent.clientX;
        const newWidth = startWidth + (diff / window.innerWidth) * 100;
        setEditorWidth(Math.max(20, Math.min(80, newWidth))); 
    };
    const onMouseUp = () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); };
    document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp);
  }, [editorWidth]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session as any); if (!session) setIsInitializing(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session as any); if (!session) setIsInitializing(false); });

    setGithubRepo(localStorage.getItem('dialogtree_github_repo') || "");
    setGithubToken(localStorage.getItem('dialogtree_github_token') || "");
    setVercelToken(localStorage.getItem('dialogtree_vercel_token') || "");
    setRenderToken(localStorage.getItem('dialogtree_render_token') || "");
    setSupabaseToken(localStorage.getItem('dialogtree_supabase_token') || "");

    return () => { subscription.unsubscribe(); if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const setup = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const joinId = urlParams.get('workspace');
        const customName = urlParams.get('newWsName');
        const recent = JSON.parse(localStorage.getItem('recent_workspaces') || '[]');
        setRecentWorkspaces(recent);

        if (customName) {
            const data = await api.init(session.user.id, customName, null);
            if (data.workspace) {
                setWorkspace(data.workspace); setActiveBranch(data.branch);
                const branchData = await api.getBranches(data.workspace.id); setBranches(branchData.branches);
                const updated = [{ id: data.workspace.id, name: data.workspace.name }, ...recent].slice(0, 10);
                localStorage.setItem('recent_workspaces', JSON.stringify(updated)); setRecentWorkspaces(updated);
                window.history.replaceState({}, '', `/?workspace=${data.workspace.id}`);
            }
        } else if (joinId) {
            const data = await api.init(session.user.id, "Joined Workspace", joinId);
            if (data.workspace) {
                setWorkspace(data.workspace); setActiveBranch(data.branch);
                const branchData = await api.getBranches(data.workspace.id); setBranches(branchData.branches);
                if (!recent.find((w: any) => w.id === data.workspace.id)) {
                    const updated = [{ id: data.workspace.id, name: data.workspace.name }, ...recent].slice(0, 10);
                    localStorage.setItem('recent_workspaces', JSON.stringify(updated)); setRecentWorkspaces(updated);
                }
            }
        } else if (recent.length > 0) {
            await switchWorkspace(recent[0].id);
        } else {
            setWorkspace(null); 
        }
        setIsInitializing(false);
      } catch (err: any) { 
          toast.error(`Backend Error: ${err.message}`);
          setWorkspace(null); setIsInitializing(false); 
      }
    };
    setup();
  }, [session?.user?.id]);

  useEffect(() => {
    const loadHistoryAndFiles = async () => {
      if (!activeBranch) return;
      setSwitching(true); setActiveArtifact(null); setEditorErrors([]);
      try {
        const historyData = await api.getMessages(activeBranch.id); setMessages(historyData.messages || []);
        const { data: fileData } = await supabase.from('files').select('*').eq('branch_id', activeBranch.id);
        if (fileData) setRepoFiles(fileData);
      } catch (err) {} finally { setSwitching(false); }
    };
    loadHistoryAndFiles();
  }, [activeBranch]);

  useEffect(() => {
    if (!workspace) return;
    api.getChitchat(workspace.id).then(res => setChitchatMsgs(res.messages || []));
    const channel = supabase.channel('room_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        if (activeBranch) api.getMessages(activeBranch.id).then(res => setMessages(res.messages || []));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, async () => {
        if (activeBranch) {
            const { data } = await supabase.from('files').select('*').eq('branch_id', activeBranch.id);
            if (data) setRepoFiles(data);
        }
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

  const switchWorkspace = async (id: string) => {
      if (editingWsId === id || workspace?.id === id) return;
      const targetWs = recentWorkspaces.find(w => w.id === id);
      if (targetWs) {
          setWorkspace(targetWs); window.history.pushState({}, '', `/?workspace=${id}`); setSwitching(true);
          try {
              const branchData = await api.getBranches(id);
              if (branchData.branches && branchData.branches.length > 0) {
                  setBranches(branchData.branches);
                  setActiveBranch(branchData.branches.find((b:any) => b.name === 'main') || branchData.branches[0]);
              }
          } catch(e) {}
      }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName } } });
        if (error) throw error;
        if (data.user && !data.session) { 
            toast.success('Registration successful! Please check your email.');
            setAuthEmail(''); setAuthPassword(''); setAuthName(''); setIsSignUp(false); 
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        toast.success('Welcome back!');
      }
    } catch (error: any) { toast.error(error.message); } finally { setAuthLoading(false); }
  };

  const handleOAuth = async (provider: 'google' | 'github') => { await supabase.auth.signInWithOAuth({ provider }); };
  const handleLogout = async () => { await supabase.auth.signOut(); setWorkspace(null); setActiveBranch(null); setMessages([]); setRepoFiles([]); toast.success('Logged out securely.'); };

  const createNewWorkspace = () => { const hash = Math.floor(1000 + Math.random() * 9000); window.location.href = `/?newWsName=Untitled Workspace ${hash}`; };

  const spawnTemplate = async (type: 'react-vite' | 'nextjs') => {
      setLoading(true);
      const toastId = toast.loading(`Spawning ${type === 'react-vite' ? 'React' : 'Next.js'} Template...`);
      try {
          const wsName = type === 'react-vite' ? 'React + Vite App' : 'Next.js App';
          const initData = await api.init(session!.user.id, wsName, null);
          const newBranchId = initData.branch.id;

          let files: any[] = [];
          if (type === 'react-vite') {
              files = [
                  { branch_id: newBranchId, filename: 'package.json', language: 'json', content: `{\n  "name": "vite-react",\n  "private": true,\n  "version": "0.0.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  },\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.2.1",\n    "vite": "^5.1.4"\n  }\n}` },
                  { branch_id: newBranchId, filename: 'vite.config.js', language: 'javascript', content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})` },
                  { branch_id: newBranchId, filename: 'index.html', language: 'html', content: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Vite + React</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>` },
                  { branch_id: newBranchId, filename: 'src/main.jsx', language: 'javascript', content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)` },
                  { branch_id: newBranchId, filename: 'src/App.jsx', language: 'javascript', content: `export default function App() {\n  return (\n    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>\n      <h1 style={{ color: '#6366f1' }}>⚡️ Vite + React Sandbox</h1>\n      <p>Your instant WebContainer is ready. Ask Gemini to add some components!</p>\n    </div>\n  )\n}` },
              ];
          }

          await supabase.from('files').insert(files);
          await supabase.from('messages').insert({
              branch_id: newBranchId, role: 'system', sender_type: 'system',
              content: `✅ **Successfully scaffolded ${wsName} template.**`
          });

          toast.success('Template deployed successfully!', { id: toastId });
          window.location.href = `/?workspace=${initData.workspace.id}`;
      } catch (err: any) { 
          toast.error("Failed to spawn template.", { id: toastId }); 
      } finally { setLoading(false); }
  };

  const saveWorkspaceRename = async (wsId: string) => {
      if (!editWsName.trim()) { setEditingWsId(null); return; }
      try {
          await supabase.from('workspaces').update({ name: editWsName }).eq('id', wsId);
          const updated = recentWorkspaces.map(w => w.id === wsId ? { ...w, name: editWsName } : w);
          localStorage.setItem('recent_workspaces', JSON.stringify(updated)); setRecentWorkspaces(updated);
          if (workspace?.id === wsId) setWorkspace({ ...workspace, name: editWsName });
          toast.success('Workspace renamed');
      } catch (err) { toast.error('Failed to rename workspace'); } finally { setEditingWsId(null); }
  };

  const triggerDeleteWorkspace = (wsId: string, wsName: string, e: React.MouseEvent) => {
      e.stopPropagation(); e.preventDefault();
      const updated = recentWorkspaces.filter(w => w.id !== wsId);
      setRecentWorkspaces(updated); localStorage.setItem('recent_workspaces', JSON.stringify(updated));
      if (workspace?.id === wsId) { setWorkspace(null); setActiveBranch(null); window.history.pushState({}, '', `/`); }
      const timer = setTimeout(async () => { await supabase.from('workspaces').delete().eq('id', wsId); setUndoToast(null); }, 5000);
      setUndoToast({ id: wsId, name: wsName, timer });
  };

  const handleUndoDelete = () => {
      if (undoToast) {
          clearTimeout(undoToast.timer);
          const restored = [{ id: undoToast.id, name: undoToast.name }, ...recentWorkspaces];
          setRecentWorkspaces(restored); localStorage.setItem('recent_workspaces', JSON.stringify(restored));
          if (!workspace) switchWorkspace(undoToast.id);
          setUndoToast(null);
          toast.success('Deletion reverted');
      }
  };

  const simulatePipeline = () => {
      if (aiMode === 'orchestrate') {
          setPipelineTasks([
              { label: "Agent 1: Architecting solution...", status: 'active' },
              { label: "Agent 2: Writing logic modules...", status: 'pending' },
              { label: "Agent 3: QA & Merging files...", status: 'pending' }
          ]);
      } else if (aiMode === 'deepthink') {
           setPipelineTasks([
              { label: "Initializing Chain of Thought...", status: 'active' },
              { label: "Evaluating edge cases & security...", status: 'pending' },
              { label: "Generating final code...", status: 'pending' }
          ]);
      } else {
          setPipelineTasks([
              { label: "Analyzing context...", status: 'active' },
              { label: "Drafting code...", status: 'pending' },
              { label: "Validating Virtual File System...", status: 'pending' }
          ]);
      }
      
      setTimeout(() => setPipelineTasks(prev => [{...prev[0], status: 'done'}, {...prev[1], status: 'active'}, prev[2]]), 1500);
      setTimeout(() => setPipelineTasks(prev => [prev[0], {...prev[1], status: 'done'}, {...prev[2], status: 'active'}]), 3000);
      setTimeout(() => setPipelineTasks([]), 5000); 
  };

  const handleSend = async (overridePrompt?: string) => {
    let finalPrompt = (overridePrompt || input).trim();
    if (!finalPrompt && selectedFiles.length === 0) return;
    if (!activeBranch) return;

    setInput(""); let currentAttachments = [...selectedFiles]; setSelectedFiles([]); setLoading(true); setAiModeMenuOpen(false); simulatePipeline();

    const mentions = finalPrompt.match(/@([\w.-]+\.\w+)/g);
    if (mentions) {
        mentions.forEach(mention => {
            const filename = mention.substring(1);
            const file = allArtifacts.find(a => a.filename === filename);
            if (file && !currentAttachments.find(a => a.name === filename)) {
                currentAttachments.push({ name: filename, base64: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(file.code)))}`, type: 'text/plain', ext: file.lang });
            }
        });
    }

    let displayPrompt = finalPrompt;
    if (currentAttachments.length > 0) displayPrompt += `\n\n*(Uploaded ${currentAttachments.length} Context Artifacts)*`;

    let systemInjectedPrompt = finalPrompt;
    if (aiMode === 'deepthink') {
        systemInjectedPrompt = `[DEEPTHINK MODE ACTIVATED]\nBefore writing any code, write out a comprehensive step-by-step reasoning wrapped in <think>...</think> tags. Consider edge cases, security, and performance. Then, provide the final code.\n\nUSER PROMPT: ${finalPrompt}`;
    } else if (aiMode === 'orchestrate') {
        systemInjectedPrompt = `[ORCHESTRATION MODE]\nAct as a team of 3 expert developers. \nDev 1: Analyze the requirements.\nDev 2: Write the logic.\nDev 3: Review for bugs.\nProvide the final output combining all your work into the Virtual File System.\n\nUSER PROMPT: ${finalPrompt}`;
    } else if (aiMode === 'agent') {
        systemInjectedPrompt = `[AUTONOMOUS AGENT MODE]\nYou are an autonomous coding agent. Write the exact code requested. If there are future errors during deployment, you will be summoned automatically to fix them without user input.\n\nUSER PROMPT: ${finalPrompt}`;
    }

    const lastMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
    const safeHistory = messages.filter(m => !(m.role === 'system' && m.content.includes('✅ **Imported')));
    
    // Optimistic UI update
    setMessages(prev => [...prev, { role: 'user', content: displayPrompt, id: 'temp' }]);

    try {
      const data = await api.chat(activeBranch.id, systemInjectedPrompt, lastMsgId, safeHistory, currentAttachments);
      if (data.error) throw new Error(data.error);
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== 'temp')); 
      toast.error(`AI Engine Error: ${err.message}`);
    } finally { setLoading(false); setPipelineTasks([]); }
  };

  const handleCopilotSubmit = () => {
      if (!copilotInput.trim() || !activeArtifact || !editorSelection) return;
      handleSend(`I need to modify \`${activeArtifact.filename}\`.\n\nPlease update this specific part of the code:\n\`\`\`${activeArtifact.lang}\n${editorSelection}\n\`\`\`\n\nInstructions: ${copilotInput}`);
      setEditorSelection(""); setCopilotInput("");
  };

  const injectAIArchitectScaffold = () => {
      setInput(`**AI Model Integration Scaffold**\n\nI need to integrate a custom AI model into this project. Please build the modular pipeline.\n\n- **Model Type:** [e.g., DeepSeek R1 / Custom Finetune]\n- **Input Schema:** [e.g., JSON { text: string, max_length: number }]\n- **Expected Output:** [e.g., Streaming Markdown]\n- **Endpoint URL:** \n\nPlease generate the separate \`api/route.ts\` and the client-side \`useModel.ts\` hook.`);
  };

  const executeAutoHealer = async () => {
      if (!activeBranch) return;
      setDeployStatus('idle');
      let engineeredPrompt = `The recent deployment of this branch failed.\n\nPlease analyze the code in this branch for any compilation, build, or syntax errors, explain what caused the crash, and provide the fully corrected files.`;

      if (vercelToken) {
          const loadId = toast.loading('Fetching remote build logs...');
          try {
              const depRes = await fetch(`https://api.vercel.com/v6/deployments?state=ERROR&limit=1`, { headers: { 'Authorization': `Bearer ${vercelToken}` } });
              const depData = await depRes.json();
              if (depData.deployments && depData.deployments.length > 0) {
                  const eventRes = await fetch(`https://api.vercel.com/v2/deployments/${depData.deployments[0].uid}/events`, { headers: { 'Authorization': `Bearer ${vercelToken}` } });
                  const eventData = await eventRes.json();
                  const errorLogs = eventData.filter((log: any) => log.type === 'error').map((l:any) => l.text).join('\n');
                  if (errorLogs) {
                      engineeredPrompt = `My Vercel deployment just failed. Here are the exact build logs:\n\n\`\`\`\n${errorLogs}\n\`\`\`\n\nFind the file causing this error, fix it, and give me the complete corrected code.`;
                      toast.success('Logs retrieved. Analyzing...', { id: loadId });
                  }
              }
          } catch (err) { toast.error('Could not fetch logs. Running blind analysis.', { id: loadId }); }
      }
      
      if (aiMode === 'agent') engineeredPrompt = `[AUTONOMOUS LOOP] ` + engineeredPrompt + `\n\nFix this silently and perfectly so the next deployment succeeds.`;
      
      handleSend(engineeredPrompt);
  };

  const submitFork = async () => {
    if (!forkModal.name.trim() || !forkModal.messageId || !workspace) return; // 🔥 ADDED NULL CHECK
    setLoading(true); setForkModal(prev => ({ ...prev, isOpen: false })); 
    try { 
        await api.branch(workspace.id, forkModal.name, forkModal.isEphemeral, forkModal.messageId, activeBranch!.id); 
        toast.success(`Diverged timeline to ${forkModal.name}`);
    } 
    catch (err) { toast.error("Failed to create new timeline."); } finally { setLoading(false); }
  };

  const deleteBranch = async (branchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Using a custom toast instead of window.confirm for premium UI
    toast((t) => (
        <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold">Delete this timeline forever?</span>
            <div className="flex gap-2 justify-end">
                <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1 bg-zinc-800 text-xs rounded hover:bg-zinc-700">Cancel</button>
                <button onClick={async () => {
                    toast.dismiss(t.id);
                    try {
                        await api.deleteBranch(branchId);
                        if (activeBranch?.id === branchId) setActiveBranch(branches.find(b => b.name === 'main') || null);
                        toast.success('Timeline deleted');
                    } catch (err) { toast.error("Failed to delete"); }
                }} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-500">Delete</button>
            </div>
        </div>
    ), { duration: 5000 });
  };

  const initiateMerge = async () => {
    if (!activeBranch || activeBranch.name === 'main') { toast.error("You are already in the main timeline!"); return; }
    setPrModalOpen(true); setIsDiffLoading(true);
    try {
        const mainBranch = branches.find(b => b.name === 'main');
        if (mainBranch) {
            const res = await api.getMessages(mainBranch.id);
            if (res.messages) setMainArtifacts(extractAllArtifacts(res.messages));
        }
    } catch (err) {}
    setIsDiffLoading(false);
  };

  const confirmMerge = async () => {
    const mainBranch = branches.find(b => b.name === 'main');
    const latestSourceMsgId = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (!mainBranch || !latestSourceMsgId) return;
    setLoading(true); setPrModalOpen(false);
    const loadId = toast.loading('Merging timelines...');
    try {
      const res = await api.merge(activeBranch!.id, mainBranch.id, latestSourceMsgId, null, messages);
      if(res.error) throw new Error(res.error);
      await api.deleteBranch(activeBranch!.id);
      setActiveBranch(mainBranch); 
      toast.success('Timelines merged successfully!', { id: loadId });
    } catch(e: any) { toast.error(`Merge failed: ${e.message}`, { id: loadId }); } finally { setLoading(false); }
  };

  const executeGithubPush = async () => {
      if (!githubRepo || !githubCommitMsg || !activeArtifact || !githubToken) { toast.error("Please fill in all fields!"); return; }
      setGithubPushing(true);
      const loadId = toast.loading('Pushing to GitHub...');
      try {
          const filesToSend = githubPushAll ? allArtifacts.map(art => ({ path: art.filename, content: art.code })) : [{ path: activeArtifact.filename, content: activeArtifact.code }];
          const res = await api.pushToGithub(githubRepo, activeBranch?.name || 'main', filesToSend, githubCommitMsg, githubToken);
          if (res.error) throw new Error(res.error);
          
          toast.success(`Pushed to GitHub! Monitoring CI/CD build...`, { id: loadId });
          setGithubModalOpen(false); setGithubCommitMsg(""); setDeployStatus('building');
          
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          let attempts = 0;
          pollIntervalRef.current = setInterval(async () => {
              attempts++;
              if (attempts > 30) { clearInterval(pollIntervalRef.current as NodeJS.Timeout); setDeployStatus('idle'); return; }
              try {
                  const statusRes = await fetch(`https://api.github.com/repos/${githubRepo}/commits/${activeBranch?.name || 'main'}/status`, { headers: { 'Authorization': `token ${githubToken}` } });
                  const statusData = await statusRes.json();
                  if (statusData.state === 'success') {
                      setDeployStatus('success'); clearInterval(pollIntervalRef.current as NodeJS.Timeout);
                      toast.success('Live Deployment Successful!');
                      setTimeout(() => setDeployStatus('idle'), 5000);
                  } else if (statusData.state === 'failure' || statusData.state === 'error') {
                      setDeployStatus('error'); clearInterval(pollIntervalRef.current as NodeJS.Timeout);
                      toast.error('Deployment Failed.');
                      if (aiMode === 'agent') {
                          toast.loading('Agent auto-healing activated...');
                          executeAutoHealer();
                      }
                  }
              } catch (err) {}
          }, 5000);
      } catch (err: any) { toast.error(err.message, { id: loadId }); } finally { setGithubPushing(false); }
  };

  const executeGithubFetchTree = async () => {
      if (!githubRepo) return;
      setGithubImporting(true);
      const loadId = toast.loading('Fetching repository map...');
      try {
          const res = await api.getGithubTree(githubRepo, githubToken);
          if (res.error) throw new Error(res.error);
          setRepoTree(res.tree); setSelectedTreeFiles(new Set(res.tree.map((f: any) => f.path)));
          const root: any = {};
          res.tree.forEach((file: any) => {
              const parts = file.path.split('/'); let current = root;
              parts.forEach((part: string, i: number) => {
                  if (!current[part]) current[part] = i === parts.length - 1 ? { _isFile: true } : {};
                  current = current[part];
              });
          });
          setFolderStructure(root); setImportStep('select');
          toast.success('Map loaded.', { id: loadId });
      } catch (err: any) { toast.error(err.message, { id: loadId }); } finally { setGithubImporting(false); }
  };

  const toggleFileSelection = (path: string) => {
      setSelectedTreeFiles(prev => {
          const next = new Set(prev);
          if (next.has(path)) next.delete(path); else next.add(path);
          return next;
      });
  };

  const toggleFolderSelection = (path: string) => {
      setSelectedTreeFiles(prev => {
          const next = new Set(prev);
          const folderFiles = repoTree.filter(f => f.path.startsWith(path + '/'));
          const allSelected = folderFiles.every(f => next.has(f.path));
          folderFiles.forEach(f => {
              if (allSelected) next.delete(f.path); else next.add(f.path);
          });
          return next;
      });
  };

  const executeGithubImportFiles = async () => {
      if (!activeBranch || selectedTreeFiles.size === 0) return;
      setGithubImporting(true);
      const loadId = toast.loading(`Importing ${selectedTreeFiles.size} files...`);
      try {
          const filesToFetch = repoTree.filter(f => selectedTreeFiles.has(f.path));
          const res = await api.importGithubFiles(githubRepo, filesToFetch, githubToken);
          if (res.error) throw new Error(res.error);
          
          const fileRows = res.files.map((f: any) => {
              const ext = f.path.split('.').pop() || 'text';
              let lang = ext === 'js' ? 'javascript' : ext === 'ts' ? 'typescript' : ext === 'tsx' ? 'tsx' : ext === 'py' ? 'python' : ext === 'cpp' || ext === 'hpp' || ext === 'h' ? 'cpp' : ext;
              return { branch_id: activeBranch.id, filename: f.path, content: f.content, language: lang };
          });

          const { error: fileError } = await supabase.from('files').insert(fileRows);
          if (fileError) throw fileError;

          await supabase.from('messages').insert({
              branch_id: activeBranch.id, role: 'system', sender_type: 'system',
              content: `✅ **Imported ${res.files.length} files from \`${githubRepo}\` into the Virtual File System.**`
          });
          
          setImportModalOpen(false); setImportStep('input');
          toast.success('Files successfully injected.', { id: loadId });
      } catch (err: any) { toast.error(err.message, { id: loadId }); } finally { setGithubImporting(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (files.some(f => f.size > 1024 * 1024 * 10)) { toast.error("File exceeds 10MB limit."); return; }
    const newFiles = await Promise.all(files.map(file => {
      return new Promise<{name: string, base64: string, type: string, ext: string}>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ name: file.name, base64: reader.result as string, type: file.type, ext: file.name.split('.').pop() || 'txt' });
        reader.readAsDataURL(file);
      });
    }));
    setSelectedFiles(prev => [...prev, ...newFiles as any]);
    if(fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const handleChitchatSend = async () => {
    if (!chitchatInput.trim() || !workspace) return;
    const msg = chitchatInput;
    setChitchatInput("");
    const userName = session!.user.user_metadata?.full_name || session!.user.email.split('@')[0];
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
        navigator.clipboard.writeText(`${window.location.origin}?workspace=${workspace.id}`);
        toast.success("Invite link copied to clipboard!");
    }
  };

  const MarkdownComponents = {
    code({node, inline, className, children, ...props}: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      return !inline && match ? (
        <div className="relative group my-5 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-zinc-800/50">
             <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">{match[1]}</span>
             <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
               <button onClick={() => { navigator.clipboard.writeText(codeString); toast.success('Copied to clipboard'); }} className="text-zinc-400 hover:text-zinc-200 text-xs">Copy</button>
               <button onClick={() => { setActiveArtifact({ code: codeString, lang: match[1], filename: 'snippet' }); setEditorTab('code'); }} className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold ml-2 flex items-center gap-1"><Code size={12}/> Edit</button>
             </div>
          </div>
          {/* @ts-ignore */}
          <SyntaxHighlighter language={match[1]} style={vscDarkPlus} customStyle={{margin: 0, padding: '1rem', fontSize: '13px', backgroundColor: '#0d1117'}}>{codeString}</SyntaxHighlighter>
        </div>
      ) : (<code className="bg-zinc-800 text-indigo-300 px-1.5 py-0.5 rounded-md text-[13px]" {...props}>{children}</code>)
    }
  };

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
          <Toaster position="bottom-right" toastOptions={{ style: { background: '#18181b', color: '#e4e4e7', border: '1px solid #27272a' } }} />
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
              </div>
              <div className="flex gap-3 mb-6">
                <button onClick={() => handleOAuth('google')} className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm font-medium transition-all"><Globe size={16} className="text-zinc-400" /> Google</button>
                <button onClick={() => handleOAuth('github')} className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm font-medium transition-all"><GitCommit size={16} className="text-zinc-400" /> GitHub</button>
              </div>
              <div className="relative flex items-center py-4 mb-2">
                <div className="flex-grow border-t border-zinc-800"></div><span className="flex-shrink-0 mx-4 text-zinc-500 text-xs uppercase tracking-widest">Or continue with email</span><div className="flex-grow border-t border-zinc-800"></div>
              </div>
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {authError && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg">{authError}</div>}
                {isSignUp && (
                  <div><label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Full Name</label><input type="text" value={authName} onChange={e => setAuthName(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500" placeholder="Jane Doe" /></div>
                )}
                <div><label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label><input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500" placeholder="engineer@example.com" /></div>
                <div><label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label><input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500" placeholder="••••••••" /></div>
                <button type="submit" disabled={authLoading} className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2 mt-4">{authLoading ? <Loader2 size={18} className="animate-spin text-zinc-500" /> : null}{isSignUp ? 'Create Account' : 'Sign In'}</button>
              </form>
              <div className="mt-8 text-center"><button onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }} className="text-sm text-zinc-500 hover:text-indigo-400 transition-colors">{isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}</button></div>
            </div>
          </div>
        </div>
      );
    }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden">
      
      {/* 🔥 THE TOASTER COMPONENT */}
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#18181b', color: '#e4e4e7', border: '1px solid #27272a' } }} />

      {workspace && session && <MultiplayerCursors workspaceId={workspace.id} user={session.user} />}

      {undoToast && (
         <div className="fixed bottom-6 left-6 bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <span>Deleted <b>{undoToast.name}</b></span>
            <div className="w-px h-4 bg-zinc-600"></div>
            <button onClick={handleUndoDelete} className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors flex items-center gap-1.5"><RotateCcw size={14}/> Undo</button>
         </div>
      )}

      {pipelineTasks.length > 0 && (
         <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 p-4 rounded-2xl shadow-2xl z-[60] w-80 pointer-events-none animate-in slide-in-from-top-4 fade-in">
             <div className="text-xs font-bold text-indigo-400 mb-3 flex items-center gap-2 uppercase tracking-wider"><Activity size={14} className="animate-pulse" /> AI Agent Pipeline</div>
             <div className="space-y-2">
                 {pipelineTasks.map((task, i) => (
                     <div key={i} className={`flex items-center gap-2 text-sm ${task.status === 'active' ? 'text-white' : task.status === 'done' ? 'text-zinc-500' : 'text-zinc-600'}`}>
                         {task.status === 'done' ? <CheckCircle size={14} className="text-emerald-500"/> : task.status === 'active' ? <Loader2 size={14} className="animate-spin text-indigo-500"/> : <div className="w-3.5 h-3.5 border-2 border-zinc-700 rounded-full" />}
                         {task.label}
                     </div>
                 ))}
             </div>
         </div>
      )}

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

      {deploySettingsOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><Settings size={20} className="text-zinc-400"/> Integrations & Secrets</h2>
                <button onClick={() => setDeploySettingsOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            <p className="text-xs text-zinc-400 mb-6 bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-start gap-2">
                <Shield size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                These Personal Access Tokens allow the Auto-Healer to read your build logs. They are stored securely in your browser's LocalStorage and are NEVER saved to a database.
            </p>
            <div className="space-y-4 mb-6">
                <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4 flex items-center gap-2 text-sm font-medium text-zinc-300"><Cloud size={16} className="text-zinc-500"/> Vercel Token</div>
                    <input type="password" value={vercelToken} onChange={e => { setVercelToken(e.target.value); localStorage.setItem('dialogtree_vercel_token', e.target.value); }} placeholder="y0ur_v3rc3l_t0k3n..." className="col-span-8 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:border-indigo-500 text-sm" />
                </div>
                <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4 flex items-center gap-2 text-sm font-medium text-zinc-300"><Server size={16} className="text-zinc-500"/> Render Token</div>
                    <input type="password" value={renderToken} onChange={e => { setRenderToken(e.target.value); localStorage.setItem('dialogtree_render_token', e.target.value); }} placeholder="rnd_xxxxxxxxxxxx..." className="col-span-8 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:border-indigo-500 text-sm" />
                </div>
                <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4 flex items-center gap-2 text-sm font-medium text-zinc-300"><Database size={16} className="text-zinc-500"/> Supabase PAT</div>
                    <input type="password" value={supabaseToken} onChange={e => { setSupabaseToken(e.target.value); localStorage.setItem('dialogtree_supabase_token', e.target.value); }} placeholder="sbp_xxxxxxxxxxxx..." className="col-span-8 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:border-indigo-500 text-sm" />
                </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setDeploySettingsOpen(false)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold">Done</button></div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><Import size={20} className="text-emerald-400"/> Import Repository</h2>
                <button onClick={() => { setImportModalOpen(false); setImportStep('input'); }} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            
            {importStep === 'input' ? (
                <>
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Repository (owner/repo)</label>
                            <input type="text" value={githubRepo} onChange={e => { setGithubRepo(e.target.value); localStorage.setItem('dialogtree_github_repo', e.target.value); }} placeholder="e.g. karanmertiya/dialogtree" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-none focus:border-indigo-500 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">GitHub Token (If Private)</label>
                            <input type="password" value={githubToken} onChange={e => { setGithubToken(e.target.value); localStorage.setItem('dialogtree_github_token', e.target.value); }} placeholder="Optional for public repos..." className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 focus:outline-none focus:border-indigo-500 text-sm" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setImportModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400">Cancel</button>
                        <button onClick={executeGithubFetchTree} disabled={githubImporting || !githubRepo} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
                            {githubImporting ? <Loader2 size={14} className="animate-spin"/> : <Folder size={14}/>} Select Files...
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className="mb-4">
                        <div className="flex justify-between items-center text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 border-b border-zinc-800 pb-2">
                            <span>Select files to import ({selectedTreeFiles.size} selected)</span>
                            <div className="flex gap-3">
                                <button onClick={() => setSelectedTreeFiles(new Set(repoTree.map(f => f.path)))} className="hover:text-emerald-400 transition-colors">Select All</button>
                                <button onClick={() => setSelectedTreeFiles(new Set())} className="hover:text-zinc-200 transition-colors">Clear</button>
                            </div>
                        </div>
                        <div className="max-h-80 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-2 custom-scrollbar">
                            {Object.keys(folderStructure).map(key => (
                                <FolderTreeItem key={key} node={folderStructure[key]} path={key} selectedFiles={selectedTreeFiles} toggleFile={toggleFileSelection} toggleFolder={toggleFolderSelection} />
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between items-center mt-6">
                        <button onClick={() => setImportStep('input')} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">Back</button>
                        <button onClick={executeGithubImportFiles} disabled={githubImporting || selectedTreeFiles.size === 0} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/20">
                            {githubImporting ? <Loader2 size={14} className="animate-spin"/> : <Import size={14}/>} Import {selectedTreeFiles.size} Files
                        </button>
                    </div>
                </>
            )}
          </div>
        </div>
      )}

      {githubModalOpen && activeArtifact && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><GitCommit size={20} className="text-white"/> Commit to GitHub</h2>
                <button onClick={() => setGithubModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={20}/></button>
            </div>
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Repository (owner/repo)</label>
                    <input type="text" value={githubRepo} onChange={e => { setGithubRepo(e.target.value); localStorage.setItem('dialogtree_github_repo', e.target.value); }} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Commit Message</label>
                    <input type="text" value={githubCommitMsg} onChange={e => setGithubCommitMsg(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">GitHub Personal Access Token</label>
                    <input type="password" value={githubToken} onChange={e => { setGithubToken(e.target.value); localStorage.setItem('dialogtree_github_token', e.target.value); }} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 text-sm" />
                </div>
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                        <input type="checkbox" checked={githubPushAll} onChange={(e) => setGithubPushAll(e.target.checked)} className="rounded bg-zinc-900 border-zinc-700 text-indigo-600" />
                        Push entire <b>{activeBranch?.name || 'main'}</b> timeline ({allArtifacts.length} files)
                    </label>
                </div>
            </div>
            <div className="flex justify-end gap-3">
                <button onClick={() => setGithubModalOpen(false)} className="px-4 py-2 text-sm text-zinc-400">Cancel</button>
                <button onClick={executeGithubPush} disabled={githubPushing || !githubRepo || !githubCommitMsg || !githubToken} className="px-4 py-2 bg-white hover:bg-zinc-200 text-black rounded-lg text-sm font-semibold flex items-center gap-2">
                    {githubPushing ? <Loader2 size={14} className="animate-spin"/> : <GitCommit size={14}/>} Push
                </button>
            </div>
          </div>
        </div>
      )}

      <MergeRequestModal isOpen={prModalOpen} onClose={() => setPrModalOpen(false)} onConfirm={confirmMerge} activeBranch={activeBranch} timelineArtifacts={allArtifacts} mainArtifacts={mainArtifacts} isDiffLoading={isDiffLoading} loading={loading} />

      <aside className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-950/50 z-10 shrink-0">
        <div className="p-4 flex items-center justify-between mb-2">
          <div className="flex items-center gap-2"><div className="bg-indigo-600 p-1.5 rounded-lg"><GitBranch size={18} className="text-white" /></div><h1 className="font-bold text-md tracking-tight">DialogTree</h1></div>
        </div>
        
        <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar">
          
          <div className="mb-6">
            <div className="text-xs font-semibold text-zinc-500 mb-2 px-2 uppercase tracking-wider flex justify-between items-center">
                Workspaces
                <div className="flex gap-2">
                    <button onClick={() => setImportModalOpen(true)} className="hover:text-emerald-400 transition-colors" title="Import from GitHub"><Import size={14}/></button>
                    <button onClick={createNewWorkspace} className="hover:text-indigo-400 transition-colors" title="New Workspace"><Plus size={14}/></button>
                </div>
            </div>
            <div className="space-y-1">
                {recentWorkspaces.map(ws => (
                    <div key={ws.id} className="relative flex items-center group">
                        {editingWsId === ws.id ? (
                            <div className="flex-1 flex items-center px-2 py-1.5 rounded-md bg-zinc-800 border border-zinc-700">
                                <input type="text" autoFocus value={editWsName} onChange={(e) => setEditWsName(e.target.value)} onBlur={() => saveWorkspaceRename(ws.id)} onKeyDown={(e) => { if (e.key === 'Enter') saveWorkspaceRename(ws.id); }} className="bg-transparent text-sm text-zinc-200 focus:outline-none w-full" />
                            </div>
                        ) : (
                            <div onClick={() => switchWorkspace(ws.id)} onDoubleClick={(e) => { e.stopPropagation(); setEditingWsId(ws.id); setEditWsName(ws.name); }} className={`flex-1 flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${workspace?.id === ws.id ? 'bg-indigo-900/30 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}>
                                <div className="flex items-center gap-2 truncate pr-2">
                                    <Folder size={14} className="shrink-0"/><span className="truncate select-none">{ws.name}</span>
                                </div>
                            </div>
                        )}
                        <button onClick={(e) => triggerDeleteWorkspace(ws.id, ws.name, e)} className="absolute right-2 p-1.5 bg-zinc-950/80 rounded-md text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash size={14} /></button>
                    </div>
                ))}
            </div>
          </div>

          {workspace && (<div className="text-xs font-semibold text-zinc-500 mb-3 px-2 uppercase tracking-wider">Timelines</div>)}
          
          {workspace && branches.length === 0 ? (<div className="px-2 text-zinc-600 text-sm italic">Loading branches...</div>) : (
            <div className="relative space-y-1 pb-4">
               {branches.map((b) => {
                 const depth = getBranchDepth(b, branches);
                 return (
                   <div key={b.id} className="relative flex items-center group" style={{ paddingLeft: `${depth * 16}px` }}>
                     {depth > 0 && <div className="absolute w-3 border-t border-zinc-700" style={{ left: `${(depth * 16) - 10}px` }}></div>}
                     <button onClick={() => setActiveBranch(b)} className={`flex-1 flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeBranch?.id === b.id ? 'bg-zinc-800 text-indigo-400 border border-zinc-700' : 'hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}>
                       <div className="flex items-center gap-2 truncate pr-2">
                           {b.is_ephemeral ? <Zap size={14} className="text-amber-400 shrink-0" /> : <GitBranch size={14} className="shrink-0" />}<span className="truncate">{b.name}</span>
                       </div>
                       {b.name !== 'main' && (<Trash size={14} onClick={(e) => deleteBranch(b.id, e)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />)}
                     </button>
                   </div>
                 );
               })}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 bg-zinc-950">
        
        {!workspace ? (
            <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950 overflow-y-auto">
                <div className="max-w-2xl w-full text-center py-12">
                    <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-2xl w-max mx-auto mb-6">
                        <Code size={32} className="text-indigo-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome to DialogTree</h2>
                    <p className="text-zinc-400 mb-10 leading-relaxed max-w-lg mx-auto">Create an empty workspace, import an existing GitHub repository, or instantly spawn a full WebContainer scaffold.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <button onClick={() => setImportModalOpen(true)} className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-900/10 text-zinc-200 p-6 rounded-2xl transition-all flex flex-col items-center gap-3 group text-sm font-medium">
                            <Import size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" /> Import GitHub Repo
                        </button>
                        <button onClick={() => spawnTemplate('react-vite')} className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-900/10 text-zinc-200 p-6 rounded-2xl transition-all flex flex-col items-center gap-3 group text-sm font-medium">
                            <Zap size={24} className="text-amber-500 group-hover:scale-110 transition-transform" /> Spawn React + Vite
                        </button>
                        <button onClick={createNewWorkspace} className="bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-indigo-900/10 text-zinc-200 p-6 rounded-2xl transition-all flex flex-col items-center gap-3 group text-sm font-medium">
                            <File size={24} className="text-indigo-500 group-hover:scale-110 transition-transform" /> Blank Workspace
                        </button>
                    </div>
                </div>
            </div>
        ) : (
            <>
                <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur-sm z-10 shrink-0">
                  <div className="flex items-center gap-3">
                     <span className="text-sm font-medium text-zinc-400">active:</span>
                     <code className="bg-zinc-900 px-3 py-1 rounded-md text-xs text-indigo-300 border border-zinc-700 flex items-center gap-2">{activeBranch?.is_ephemeral && <Zap size={12} className="text-amber-400"/>}{activeBranch?.name || 'loading...'}</code>
                  </div>
                  <div className="flex items-center gap-3">
                    
                    {deployStatus === 'building' && (<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold animate-pulse"><Loader2 size={14} className="animate-spin" /> Building CI/CD...</div>)}
                    {deployStatus === 'success' && (<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold"><CheckCircle2 size={14} /> Deploy Success</div>)}
                    {deployStatus === 'error' && (
                        <div className="flex items-center gap-2">
                            <button onClick={executeAutoHealer} className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-red-500 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-bounce"><AlertTriangle size={14} /> Deploy Failed - Auto Fix</button>
                            <button onClick={() => setDeploySettingsOpen(true)} className="p-1.5 text-zinc-500 hover:text-zinc-300" title="Settings"><Settings size={14}/></button>
                        </div>
                    )}
                    {deployStatus === 'idle' && (<button onClick={() => setDeploySettingsOpen(true)} className="p-1.5 text-zinc-500 hover:text-zinc-300" title="Deploy Settings"><Settings size={14}/></button>)}

                    <button onClick={injectAIArchitectScaffold} className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-indigo-900/50 hover:bg-indigo-900/20 text-xs font-medium transition-all text-indigo-400 bg-zinc-900 shadow-sm ml-2">
                        <Cpu size={14} /> Train / Integrate Model
                    </button>

                    <button onClick={() => setIsArtifactSidebarOpen(!isArtifactSidebarOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ml-2 ${isArtifactSidebarOpen || allArtifacts.length > 0 ? 'border-indigo-600/50 bg-indigo-900/20 text-indigo-300 hover:bg-indigo-900/40' : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                       <Library size={14} /> Artifacts ({allArtifacts.length})
                    </button>

                    <button onClick={initiateMerge} className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-emerald-900/50 hover:bg-emerald-900/20 text-xs font-medium transition-all text-emerald-400 bg-zinc-900 shadow-sm"><GitMerge size={14} /> Merge Request</button>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth min-h-0 custom-scrollbar" onClick={() => setExportMenuOpen(false)}>
                  {switching ? (<div className="flex justify-center mt-20"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>) : messages.length === 0 ? (<div className="text-center mt-20 text-zinc-500">Start typing...</div>) : (
                    messages.filter(m => !(m.role === 'system' && m.content.includes('✅ **Imported'))).map((m, i) => {
                      const displayContent = m.content.replace(/---START_ATTACHMENT:(.*?)---[\s\S]*?---END_ATTACHMENT---/g, '\n\n📎 **Attached Document:** `$1`');
                      return (
                      <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : m.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                        <div className={`p-5 rounded-2xl max-w-[85%] shadow-sm relative group min-w-0 ${m.role === 'user' ? 'bg-zinc-800 text-zinc-100' : m.role === 'system' ? 'bg-zinc-900/80 border border-zinc-700 text-zinc-300 rounded-lg w-full text-center text-xs font-mono tracking-wide shadow-md' : 'bg-transparent text-zinc-200'}`}>
                          <div className="prose prose-invert max-w-none text-[15px] leading-relaxed break-words overflow-hidden">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{displayContent}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )})
                  )}
                  {loading && (<div className="flex gap-3 items-center text-zinc-400 text-sm bg-zinc-900/50 w-max px-4 py-2 rounded-full border border-zinc-800/50"><Loader2 size={16} className="animate-spin text-indigo-500" /> <span>AI is thinking...</span></div>)}
                </div>

                <div className="p-6 pt-2 shrink-0">
                  <div className="max-w-4xl mx-auto relative group flex items-end gap-3 bg-zinc-900 border border-zinc-800 rounded-3xl p-2 shadow-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
                    
                    <div className="relative">
                        <button onClick={() => setAiModeMenuOpen(!aiModeMenuOpen)} className={`p-3.5 rounded-2xl transition-all mb-1 ${aiMode !== 'standard' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-zinc-800/50 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800'}`} title="AI Agent Mode">
                            {aiMode === 'standard' ? <Sparkles size={20} /> : aiMode === 'deepthink' ? <BrainCircuit size={20} /> : aiMode === 'orchestrate' ? <Network size={20} /> : <Bot size={20} />}
                        </button>
                        {aiModeMenuOpen && (
                            <div className="absolute bottom-full left-0 mb-2 w-56 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                                <div className="px-3 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">AI Reasoning Models</div>
                                <button onClick={() => { setAiMode('standard'); setAiModeMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors ${aiMode === 'standard' ? 'text-white bg-zinc-800' : 'text-zinc-300 hover:bg-zinc-800/50'}`}>
                                    <Sparkles size={16} className="text-zinc-400" /> <span>Standard <span className="text-[10px] text-zinc-500 block">Fastest generation</span></span>
                                </button>
                                <button onClick={() => { setAiMode('deepthink'); setAiModeMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors ${aiMode === 'deepthink' ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
                                    <BrainCircuit size={16} className={aiMode === 'deepthink' ? "text-indigo-400" : "text-zinc-500"} /> <span>DeepThink <span className="text-[10px] text-amber-500/70 border border-amber-500/30 px-1.5 py-0.5 rounded ml-2">BETA</span><span className="text-[10px] text-zinc-500 block">Chain-of-thought loop</span></span>
                                </button>
                                <button onClick={() => { setAiMode('orchestrate'); setAiModeMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors ${aiMode === 'orchestrate' ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
                                    <Network size={16} className={aiMode === 'orchestrate' ? "text-indigo-400" : "text-zinc-500"} /> <span>Orchestrator <span className="text-[10px] text-amber-500/70 border border-amber-500/30 px-1.5 py-0.5 rounded ml-2">BETA</span><span className="text-[10px] text-zinc-500 block">Multi-agent delegation</span></span>
                                </button>
                                <button onClick={() => { setAiMode('agent'); setAiModeMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors ${aiMode === 'agent' ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
                                    <Bot size={16} className={aiMode === 'agent' ? "text-indigo-400" : "text-zinc-500"} /> <span>Auto-Agent <span className="text-[10px] text-rose-500/70 border border-rose-500/30 px-1.5 py-0.5 rounded ml-2">EXP</span><span className="text-[10px] text-zinc-500 block">Infinite auto-heal loop</span></span>
                                </button>
                            </div>
                        )}
                    </div>

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
                      <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} disabled={switching || !activeBranch} placeholder={`Message #${activeBranch?.name || '...'} (Tip: Use @filename to fetch context)`} className="w-full bg-transparent border-none py-3 px-2 focus:outline-none focus:ring-0 text-[15px] resize-none overflow-y-auto custom-scrollbar" style={{ minHeight: '50px', maxHeight: '200px', height: input ? 'auto' : '50px' }} />
                    </div>
                    <button onClick={() => handleSend()} disabled={loading || switching || (!input.trim() && selectedFiles.length === 0)} className="p-3.5 mb-1 bg-indigo-600 rounded-2xl hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 transition-all active:scale-95 shrink-0"><Send size={18} className={(input.trim() || selectedFiles.length > 0) ? "text-white" : "text-zinc-400"} /></button>
                  </div>
                </div>
            </>
        )}
      </main>

      {isArtifactSidebarOpen && (
         <aside className="w-72 border-l border-zinc-800 bg-zinc-950/90 backdrop-blur-md flex flex-col shadow-2xl z-20 shrink-0">
            <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
               <div className="flex items-center gap-2 text-zinc-200 font-semibold text-sm"><Library size={16} className="text-indigo-400" /> Artifact Library</div>
               <button onClick={() => setIsArtifactSidebarOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
               {allArtifacts.length > 0 && (
                   <button onClick={() => downloadAllArtifacts(allArtifacts, activeBranch?.name)} className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-600/30 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all mb-4">
                       <Cloud size={14} /> Download All as ZIP
                   </button>
               )}
               {allArtifacts.length === 0 ? (
                  <div className="text-xs text-zinc-600 text-center mt-10 italic">No code generated in this timeline yet.</div>
               ) : (
                  allArtifacts.map((art, idx) => (
                     <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-indigo-500/50 transition-colors group cursor-pointer" onClick={() => { setActiveArtifact({ code: art.code, lang: art.lang, filename: art.filename }); setEditorTab('code'); }}>
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[11px] font-bold text-zinc-300 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 truncate max-w-[150px]" title={art.filename}>{art.filename.split('/').pop()}</span>
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); downloadCode(art.code, art.filename); }} className="text-zinc-400 hover:text-zinc-200 text-xs"><Download size={14}/></button>
                           </div>
                        </div>
                        <div className="text-[10px] uppercase font-bold text-indigo-400/70 mb-1.5">{art.lang}</div>
                        <div className="text-xs text-zinc-400 max-h-32 overflow-hidden font-mono bg-zinc-950 p-2 rounded border border-zinc-800/50 relative">
                            {art.code}
                            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none"></div>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </aside>
      )}

      {activeArtifact && (
        <>
            <div className="w-1 cursor-col-resize bg-zinc-800 hover:bg-indigo-500 hover:shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all z-40 active:bg-indigo-400 shrink-0" onMouseDown={startResizing} />
            <aside style={{ width: `${editorWidth}%` }} className="min-w-[300px] border-l border-zinc-800 bg-[#1e1e1e] flex flex-col shadow-2xl z-30 relative shrink-0 transition-none">
                <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900 shrink-0">
                    <div className="flex items-center gap-4 overflow-hidden pr-4">
                        <Code size={18} className="text-indigo-400 shrink-0"/>
                        <span className="text-sm font-semibold text-zinc-200 truncate" title={activeArtifact.filename}>{activeArtifact.filename.split('/').pop()}</span>
                        
                        <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 ml-4 shrink-0">
                            <button onClick={() => setEditorTab('code')} className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${editorTab === 'code' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Code</button>
                            <button onClick={() => setEditorTab('preview')} className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors ${editorTab === 'preview' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Play size={12}/> Preview</button>
                        </div>
                        {editorErrors.length > 0 && editorTab === 'code' && (
                            <button onClick={handleAutoFix} className="ml-4 flex items-center gap-1.5 px-3 py-1 bg-red-900/30 border border-red-700 hover:bg-red-900/50 text-red-400 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors animate-pulse"><Bug size={12}/> Fix {editorErrors.length}</button>
                        )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={() => setGithubModalOpen(true)} className="flex items-center gap-1.5 text-xs bg-white hover:bg-zinc-200 text-black font-semibold px-3 py-1.5 rounded-lg transition-colors"><GitCommit size={14}/> Commit</button>
                        <button onClick={() => downloadCode(activeArtifact.code, activeArtifact.filename)} className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"><Download size={14}/> D/L</button>
                        <button onClick={() => setActiveArtifact(null)} className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"><X size={18}/></button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-hidden relative">
                    <div className={`absolute inset-0 pt-4 transition-opacity ${editorTab === 'code' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                        <Editor
                            height="100%"
                            language={activeArtifact.lang === 'html' ? 'html' : activeArtifact.lang === 'css' ? 'css' : activeArtifact.lang === 'python' ? 'python' : activeArtifact.lang.includes('js') ? 'javascript' : activeArtifact.lang.includes('ts') ? 'typescript' : activeArtifact.lang.includes('cpp') ? 'cpp' : 'plaintext'}
                            theme="vs-dark"
                            value={activeArtifact.code}
                            onChange={(val) => setActiveArtifact({ ...activeArtifact, code: val || '' })}
                            onMount={handleEditorDidMount}
                            options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', padding: { top: 16 }, scrollBeyondLastLine: false, smoothScrolling: true }}
                        />
                        {editorSelection && (
                            <div className="absolute bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 w-80 animate-in fade-in slide-in-from-bottom-4">
                                <div className="text-xs font-bold text-indigo-400 mb-3 flex items-center gap-1"><Sparkles size={14}/> Copilot: Edit Selection</div>
                                <textarea value={copilotInput} onChange={e => setCopilotInput(e.target.value)} placeholder="e.g. Refactor this to be asynchronous..." className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 mb-3 resize-none shadow-inner custom-scrollbar" rows={3} autoFocus />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => { setEditorSelection(""); setCopilotInput(""); }} className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 font-medium transition-colors">Cancel</button>
                                    <button onClick={handleCopilotSubmit} disabled={!copilotInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs px-4 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-all shadow-md shadow-indigo-900/20"><Send size={12}/> Ask AI</button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className={`absolute inset-0 bg-[#0d1117] transition-opacity ${editorTab === 'preview' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                        {editorTab === 'preview' && <PreviewEngine activeArtifact={activeArtifact} allArtifacts={allArtifacts} />}
                    </div>
                </div>
            </aside>
        </>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
        [title]:hover::after {
          content: attr(title); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
          background: #18181b; padding: 4px 8px; border-radius: 4px; font-size: 10px; color: #a1a1aa;
          white-space: nowrap; z-index: 100; border: 1px solid #27272a; margin-bottom: 8px;
        }
      `}} />
    </div>
  );
}