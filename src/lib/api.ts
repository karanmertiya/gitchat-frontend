const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const api = {
  // 1. Initialize workspace
  init: (userId: string, name: string) => 
    fetch(`${API_BASE}/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, workspace_name: name }) }).then(res => res.json()),

  // 2. Send a message
  chat: (branchId: string, prompt: string, parentId?: string | null) =>
    fetch(`${API_BASE}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_id: branchId, prompt, parent_message_id: parentId }) }).then(res => res.json()),

  // 3. Create a branch
  branch: (workspaceId: string, name: string, ephemeral = false) =>
    fetch(`${API_BASE}/branch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, name, is_ephemeral: ephemeral }) }).then(res => res.json()),

  // 4. Fetch Branches
  getBranches: (workspaceId: string) =>
    fetch(`${API_BASE}/branches/${workspaceId}`).then(res => res.json()),

  // 5. Fetch Messages
  getMessages: (branchId: string) =>
    fetch(`${API_BASE}/messages/${branchId}`).then(res => res.json()),

  // 6. Make Branch Permanent
  toggleEphemeral: (branchId: string) =>
    fetch(`${API_BASE}/branch/toggle`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_id: branchId }) }).then(res => res.json())
};