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
        alert(`Backend Error: ${err.message}\n\nLogging out.`);
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
      } catch (err) {} finally {
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
            setVerifyMessage('Registration successful! Please check your email.');
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
    msgs.forEach((m, idx) => {
       if (m.role === 'ai' || m.role === 'system') {
          const regex = /
http://googleusercontent.com/immersive_entry_chip/0