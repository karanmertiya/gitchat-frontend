const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const api = {
  init: (userId: string, name: string) => 
    fetch(`${API_BASE}/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, workspace_name: name }) }).then(res => res.json()),

  // NEW: Added frontendHistory parameter
  chat: (branchId: string, prompt: string, parentId?: string | null, frontendHistory?: any[]) =>
    fetch(`${API_BASE}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_id: branchId, prompt, parent_message_id: parentId, frontendHistory }) }).then(res => res.json()),

  branch: (workspaceId: string, name: string, ephemeral = false, parentMsgId?: string | null) =>
    fetch(`${API_BASE}/branch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, name, is_ephemeral: ephemeral, parent_message_id: parentMsgId }) }).then(res => res.json()),

  getBranches: (workspaceId: string) =>
    fetch(`${API_BASE}/branches/${workspaceId}`).then(res => res.json()),

  getMessages: (branchId: string) =>
    fetch(`${API_BASE}/messages/${branchId}`).then(res => res.json()),

  toggleEphemeral: (branchId: string) =>
    fetch(`${API_BASE}/branch/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_id: branchId }) }).then(res => res.json()),

  // NEW: Added frontendHistory parameter for bulletproof merging
  merge: (sourceId: string, targetId: string, latestSourceMsgId: string, targetParentMsgId?: string | null, frontendHistory?: any[]) =>
    fetch(`${API_BASE}/merge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_branch_id: sourceId, target_branch_id: targetId, latest_message_id_in_source: latestSourceMsgId, parent_message_id_in_target: targetParentMsgId, frontendHistory }) }).then(res => res.json())
};