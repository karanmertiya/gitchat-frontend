import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { action, repo, token, filesToFetch } = await req.json();
    
    if (!repo) return NextResponse.json({ error: "Repository name is required" }, { status: 400 });

    const headers: any = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'DialogTree-App' };
    if (token) headers['Authorization'] = `token ${token}`;

    // STEP 1: FETCH THE TREE
    if (action === 'getTree') {
        const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
        if (!repoRes.ok) throw new Error("Failed to fetch repository. Check repo name and token.");
        const repoData = await repoRes.json();

        const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees/${repoData.default_branch}?recursive=1`, { headers });
        const treeData = await treeRes.json();

        // Blacklist unwanted junk, but allow ALL text/code files in ALL folders
        const filteredTree = treeData.tree.filter((item: any) => 
          item.type === 'blob' && 
          !item.path.includes('node_modules/') && 
          !item.path.includes('.next/') &&
          !item.path.includes('.git/') &&
          !item.path.endsWith('.png') && 
          !item.path.endsWith('.jpg') && 
          !item.path.endsWith('.ico') &&
          !item.path.endsWith('.svg') &&
          !item.path.endsWith('.woff2')
        );

        return NextResponse.json({ tree: filteredTree });
    }

    // STEP 2: DOWNLOAD SELECTED FILES
    if (action === 'getFiles' && filesToFetch) {
        const files = [];
        for (const item of filesToFetch) {
            const fileRes = await fetch(item.url, { headers });
            const fileData = await fileRes.json();
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            files.push({ path: item.path, content });
        }
        return NextResponse.json({ files });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}