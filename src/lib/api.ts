const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const api = {
  init: (userId: string, name: string, joinId?: string | null) => fetch(`${API_BASE}/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, workspace_name: name, join_id: joinId }) }).then(res => res.json()),
  
  chat: (branchId: string, prompt: string, parentId?: string | null, frontendHistory?: any[], attachments?: any[]) => fetch(`${API_BASE}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_id: branchId, prompt, parent_message_id: parentId, frontendHistory, attachments }) }).then(res => res.json()),
  
  chitchat: (workspaceId: string, userName: string, prompt: string, history?: any[]) => fetch(`${API_BASE}/chitchat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, user_name: userName, prompt, history }) }).then(res => res.json()),
  getChitchat: (workspaceId: string) => fetch(`${API_BASE}/chitchat/${workspaceId}`).then(res => res.json()),
  
  branch: (workspaceId: string, name: string, ephemeral = false, parentMsgId?: string | null, parentBranchId?: string | null) => fetch(`${API_BASE}/branch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, name, is_ephemeral: ephemeral, parent_message_id: parentMsgId, parent_branch_id: parentBranchId }) }).then(res => res.json()),
  deleteBranch: (branchId: string) => fetch(`${API_BASE}/branch/${branchId}`, { method: 'DELETE' }).then(res => res.json()),
  getBranches: (workspaceId: string) => fetch(`${API_BASE}/branches/${workspaceId}`).then(res => res.json()),
  getMessages: (branchId: string) => fetch(`${API_BASE}/messages/${branchId}`).then(res => res.json()),
  toggleEphemeral: (branchId: string) => fetch(`${API_BASE}/branch/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_id: branchId }) }).then(res => res.json()),
  merge: (sourceId: string, targetId: string, latestSourceMsgId: string, targetParentMsgId?: string | null, frontendHistory?: any[]) => fetch(`${API_BASE}/merge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_branch_id: sourceId, target_branch_id: targetId, latest_message_id_in_source: latestSourceMsgId, parent_message_id_in_target: targetParentMsgId, frontendHistory }) }).then(res => res.json()),
  
  pushToGithub: (repoName: string, branchName: string, files: {path: string, content: string}[], commitMessage: string, patToken?: string) => 
    fetch(`${API_BASE}/github/push`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo: repoName, branch: branchName, files: files, message: commitMessage, token: patToken }) }).then(res => res.json()),
    
  // 🔥 NEW: Pull from GitHub
  pullFromGithub: (repoName: string, patToken?: string) => 
    fetch(`/api/github/pull`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo: repoName, token: patToken }) }).then(res => res.json())
};