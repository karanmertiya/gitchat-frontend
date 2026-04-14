export interface User {
    id: string;
    email: string;
    user_metadata?: {
        full_name?: string;
    };
}

export interface Workspace {
    id: string;
    name: string;
    created_at?: string;
}

export interface Branch {
    id: string;
    name: string;
    is_ephemeral: boolean;
    parent_id?: string | null;
}

export interface Message {
    id: string;
    role: 'user' | 'model' | 'system';
    content: string;
    sender_type?: string;
}

export interface Artifact {
    filename: string;
    code: string;
    lang: string;
}

export interface FileNode {
    path: string;
    type: 'blob' | 'tree';
    url: string;
}