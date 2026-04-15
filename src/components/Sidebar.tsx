import React from 'react';
import { GitBranch, Folder, Trash, Zap, Plus, Import, LogOut, User as UserIcon } from 'lucide-react';
import { Workspace, Branch, User } from '@/types';

interface SidebarProps {
    session: { user: User } | null;
    workspace: Workspace | null;
    branches: Branch[];
    activeBranch: Branch | null;
    recentWorkspaces: Workspace[];
    editingWsId: string | null;
    editWsName: string;
    setEditWsName: (name: string) => void;
    setEditingWsId: (id: string | null) => void;
    switchWorkspace: (id: string) => void;
    saveWorkspaceRename: (id: string) => void;
    triggerDeleteWorkspace: (id: string, name: string, e: React.MouseEvent) => void;
    setActiveBranch: (branch: Branch) => void;
    deleteBranch: (id: string, e: React.MouseEvent) => void;
    setImportModalOpen: (val: boolean) => void;
    createNewWorkspace: () => void;
    handleLogout: () => void;
}

export default function Sidebar(props: SidebarProps) {
    const { session, workspace, branches, activeBranch, recentWorkspaces, editingWsId, editWsName, setEditWsName, setEditingWsId, switchWorkspace, saveWorkspaceRename, triggerDeleteWorkspace, setActiveBranch, deleteBranch, setImportModalOpen, createNewWorkspace, handleLogout } = props;

    // Helper function for UI indenting
    const getBranchDepth = (branch: any, allBranches: any[]) => {
        let depth = 0; let curr = branch;
        while (curr.parent_branch_id) {
            depth++; curr = allBranches.find((b: any) => b.id === curr.parent_branch_id) || {};
        }
        return depth;
    };

    return (
        <aside className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-950/50 z-10 shrink-0">
            <div className="p-4 flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><div className="bg-indigo-600 p-1.5 rounded-lg"><GitBranch size={18} className="text-white" /></div><h1 className="font-bold text-md tracking-tight">DialogTree</h1></div>
            </div>
            
            {session && (
                <div className="px-4 mb-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="bg-zinc-800 p-1.5 rounded-md"><UserIcon size={16} className="text-indigo-400"/></div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-zinc-300">{session.user.user_metadata?.full_name || session.user.email.split('@')[0]}</div>
                                <div className="truncate text-xs text-zinc-500">{session.user.email}</div>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="text-zinc-500 hover:text-red-400 transition-colors shrink-0 ml-2"><LogOut size={16} /></button>
                    </div>
                </div>
            )}

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
    );
}