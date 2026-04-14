import React, { useEffect, useState } from 'react';
import { Terminal } from 'lucide-react';
import { WebContainer } from '@webcontainer/api';

let webcontainerInstance: WebContainer | null = null;

export default function PreviewEngine({ activeArtifact, allArtifacts }: { activeArtifact: any, allArtifacts: any[] }) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [bootStatus, setBootStatus] = useState("Initializing Engine...");

    // 1. PYTHON ENGINE (Pyodide)
    if (activeArtifact?.lang === 'python' || activeArtifact?.filename.endsWith('.py')) {
        const pyHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>
                <style>
                    body { background: #0d1117; color: #c9d1d9; font-family: monospace; padding: 1.5rem; margin: 0; line-height: 1.6; }
                    .header { color: #58a6ff; font-weight: bold; margin-bottom: 1rem; border-bottom: 1px solid #30363d; padding-bottom: 0.5rem; }
                    #output { white-space: pre-wrap; font-size: 14px; }
                    .error { color: #ff7b72; }
                    .loader { display: inline-block; width: 12px; height: 12px; border: 2px solid #58a6ff; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite; margin-right: 8px; vertical-align: middle; }
                    @keyframes spin { 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="header" id="status"><span class="loader"></span>Initializing Python WebAssembly Engine...</div>
                <div id="output"></div>
                <script>
                    async function main() {
                        const status = document.getElementById("status");
                        const output = document.getElementById("output");
                        try {
                            let pyodide = await loadPyodide();
                            status.innerHTML = "✅ Execution Output";
                            pyodide.runPython(\`import sys\\nimport io\\nsys.stdout = io.StringIO()\`);
                            const pythonCode = \`${activeArtifact.code.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
                            await pyodide.runPythonAsync(pythonCode);
                            output.innerText = pyodide.runPython("sys.stdout.getvalue()") || "(No print output)";
                        } catch (err) {
                            status.innerHTML = "❌ Execution Error";
                            output.innerHTML = "<span class='error'>" + err + "</span>";
                        }
                    }
                    main();
                </script>
            </body>
            </html>
        `;
        return <iframe srcDoc={pyHtml} className="w-full h-full border-none bg-[#0d1117]" sandbox="allow-scripts allow-modals" />;
    }

    // 2. NODE.JS ENGINE (WebContainers for React/Next/HTML)
    useEffect(() => {
        let isMounted = true;

        const bootEngine = async () => {
            if (!webcontainerInstance) {
                setBootStatus("Booting WebContainer OS...");
                try {
                    webcontainerInstance = await WebContainer.boot();
                } catch (e: any) {
                    if (isMounted) setBootStatus(`Failed to boot OS. Check next.config.ts headers.`);
                    return;
                }
            }

            if (!isMounted) return;
            setBootStatus("Mounting Virtual File System...");
            
            let hasPackageJson = false;
            const buildTree = () => {
                const tree: any = {};
                allArtifacts.forEach(art => {
                    if (art.filename === 'package.json') hasPackageJson = true;
                    const parts = art.filename.split('/');
                    let current = tree;
                    for(let i=0; i < parts.length - 1; i++) {
                        if (!current[parts[i]]) current[parts[i]] = { directory: {} };
                        current = current[parts[i]].directory;
                    }
                    current[parts[parts.length - 1]] = { file: { contents: art.code } };
                });
                
                // Fallback for simple HTML/JS sites
                if (!hasPackageJson) {
                    tree['package.json'] = { file: { contents: JSON.stringify({ name: "preview", scripts: { start: "npx serve ." } }) } };
                }
                return tree;
            };

            await webcontainerInstance.mount(buildTree());

            setBootStatus("Installing dependencies (npm install)...");
            const installProcess = await webcontainerInstance.spawn('npm', ['install']);
            await installProcess.exit;

            if (!isMounted) return;
            setBootStatus("Starting development server...");
            await webcontainerInstance.spawn('npm', ['run', hasPackageJson ? 'dev' : 'start']);

            webcontainerInstance.on('server-ready', (port, url) => {
                if (isMounted) {
                    setPreviewUrl(url);
                    setBootStatus("Ready!");
                }
            });
        };

        bootEngine();
        return () => { isMounted = false; };
    }, [allArtifacts]);

    if (!previewUrl) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-[#0d1117] text-zinc-400 font-mono text-sm">
                <Terminal size={32} className="mb-4 text-indigo-500 animate-pulse" />
                <p>{bootStatus}</p>
            </div>
        );
    }

    return <iframe src={previewUrl} className="w-full h-full border-none bg-white" />;
}