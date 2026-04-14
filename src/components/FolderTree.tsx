import React, { useState } from 'react';
import { File, Folder, ChevronRight } from 'lucide-react';

export default function FolderTreeItem({ node, path, selectedFiles, toggleFile, toggleFolder }: any) {
    const [isOpen, setIsOpen] = useState(true);
    
    if (node._isFile) {
        return (
            <label className="flex items-center gap-3 text-sm text-zinc-300 hover:bg-zinc-800/80 p-1.5 rounded cursor-pointer transition-colors ml-4 border border-transparent hover:border-zinc-800">
                <input type="checkbox" checked={selectedFiles.has(path)} onChange={() => toggleFile(path)} className="rounded bg-zinc-900 border-zinc-700 text-emerald-600 focus:ring-emerald-600 w-4 h-4 cursor-pointer" />
                <File size={14} className="text-zinc-500 shrink-0" />
                <span className="truncate font-mono text-[13px]">{path.split('/').pop()}</span>
            </label>
        );
    }

    const folderName = path ? path.split('/').pop() : 'Root';
    const childrenKeys = Object.keys(node).filter(k => k !== '_isFile');
    
    const allNestedFiles = childrenKeys.flatMap(k => {
        const childPath = path ? `${path}/${k}` : k;
        const extractFiles = (n: any, p: string): string[] => {
            if (n._isFile) return [p];
            return Object.keys(n).filter(childK => childK !== '_isFile').flatMap(childK => extractFiles(n[childK], `${p}/${childK}`));
        };
        return extractFiles(node[k], childPath);
    });
    
    const isAllSelected = allNestedFiles.length > 0 && allNestedFiles.every(f => selectedFiles.has(f));
    const isSomeSelected = allNestedFiles.some(f => selectedFiles.has(f));

    return (
        <div className="ml-4 mt-1">
            <div className="flex items-center gap-2 text-sm text-zinc-200 hover:bg-zinc-800/50 p-1.5 rounded transition-colors group">
                <div onClick={(e) => { e.stopPropagation(); toggleFolder(allNestedFiles, !isAllSelected); }} className="cursor-pointer flex items-center justify-center w-5 h-5">
                    <input type="checkbox" checked={isAllSelected} ref={input => { if (input) input.indeterminate = isSomeSelected && !isAllSelected; }} onChange={() => {}} className="rounded bg-zinc-900 border-zinc-700 text-emerald-600 focus:ring-emerald-600 w-4 h-4 cursor-pointer" />
                </div>
                <div className="flex items-center gap-1.5 flex-1 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                    <ChevronRight size={14} className={`transition-transform text-zinc-500 group-hover:text-zinc-300 ${isOpen ? 'rotate-90' : ''}`} />
                    <Folder size={14} className="text-indigo-400 shrink-0" />
                    <span className="font-semibold text-[13px] select-none">{folderName}</span>
                </div>
            </div>
            {isOpen && (
                <div className="border-l border-zinc-800/50 ml-2.5 mt-1 space-y-0.5">
                    {childrenKeys.map(key => (
                        <FolderTreeItem key={key} node={node[key]} path={path ? `${path}/${key}` : key} selectedFiles={selectedFiles} toggleFile={toggleFile} toggleFolder={toggleFolder} />
                    ))}
                </div>
            )}
        </div>
    );
}