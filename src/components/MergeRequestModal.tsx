"use client";
import React from 'react';
import { GitMerge, X, GitBranch, Loader2, File } from 'lucide-react';
import { computeLineDiff } from '@/lib/dialogUtils';

export default function MergeRequestModal({ 
    isOpen, onClose, onConfirm, activeBranch, 
    timelineArtifacts, mainArtifacts, isDiffLoading, loading 
}: any) {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-[95vw] lg:max-w-6xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
           <div>
              <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-100"><GitMerge size={22} className="text-emerald-400"/> Open Merge Request</h2>
              <p className="text-sm text-zinc-400 mt-1">Review side-by-side differences before squashing into the main branch.</p>
           </div>
           <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={24}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950 flex flex-col gap-6">
           <div className="flex items-center gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <div className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-mono"><GitBranch size={16} className="text-indigo-400"/> {activeBranch?.name}</div>
              <span className="text-zinc-500">→</span>
              <div className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-mono"><GitBranch size={16} className="text-zinc-400"/> main</div>
           </div>
           {isDiffLoading ? (
               <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
                   <Loader2 size={24} className="animate-spin text-emerald-500" />
                   <p className="text-sm">Analyzing side-by-side differences against main...</p>
               </div>
           ) : (
               <div>
                  <h3 className="text-zinc-300 text-sm font-semibold mb-3">Files Changed ({timelineArtifacts.length})</h3>
                  {timelineArtifacts.length === 0 ? (
                     <div className="text-center p-8 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-sm">No code files were generated in this timeline. The AI will summarize the conversation text instead.</div>
                  ) : (
                     <div className="flex flex-col gap-8">
                        {timelineArtifacts.map((art: any, idx: number) => {
                           const oldArt = mainArtifacts.slice().reverse().find((a: any) => a.filename === art.filename);
                           const isNew = !oldArt;
                           const isUnchanged = oldArt && oldArt.code === art.code;
                           
                           let sbsRows: any[] = [];
                           if (oldArt && !isUnchanged) {
                               const diffLines = computeLineDiff(oldArt.code, art.code);
                               let lLine = 1, rLine = 1;
                               for (let i = 0; i < diffLines.length; i++) {
                                   const line = diffLines[i];
                                   if (line.type === 'unchanged') {
                                       sbsRows.push({ leftNum: lLine++, leftCode: line.value, leftType: 'unchanged', rightNum: rLine++, rightCode: line.value, rightType: 'unchanged' });
                                   } else if (line.type === 'removed') {
                                       let removedChunk = [];
                                       while(i < diffLines.length && diffLines[i].type === 'removed') removedChunk.push(diffLines[i++]);
                                       let addedChunk = [];
                                       while(i < diffLines.length && diffLines[i].type === 'added') addedChunk.push(diffLines[i++]);
                                       i--; 

                                       const maxLen = Math.max(removedChunk.length, addedChunk.length);
                                       for(let k=0; k<maxLen; k++) {
                                           const rLineObj = removedChunk[k];
                                           const aLineObj = addedChunk[k];
                                           sbsRows.push({
                                               leftNum: rLineObj ? lLine++ : null,
                                               leftCode: rLineObj ? rLineObj.value : '',
                                               leftType: rLineObj ? 'removed' : 'empty',
                                               rightNum: aLineObj ? rLine++ : null,
                                               rightCode: aLineObj ? aLineObj.value : '',
                                               rightType: aLineObj ? 'added' : 'empty'
                                           });
                                       }
                                   } else if (line.type === 'added') {
                                       let addedChunk = [];
                                       while(i < diffLines.length && diffLines[i].type === 'added') addedChunk.push(diffLines[i++]);
                                       i--;
                                       for(let k=0; k<addedChunk.length; k++) {
                                           sbsRows.push({ leftNum: null, leftCode: '', leftType: 'empty', rightNum: rLine++, rightCode: addedChunk[k].value, rightType: 'added' });
                                       }
                                   }
                               }
                           }

                           return (
                               <div key={idx} className="bg-[#0d1117] border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                                    <div className="bg-zinc-900 px-4 py-3 border-b border-zinc-800 flex justify-between items-center">
                                        <span className="text-[13px] font-bold text-zinc-300 flex items-center gap-2"><File size={16} className="text-indigo-400"/> {art.filename}</span>
                                        {isNew ? <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded font-medium border border-emerald-400/20">New File</span> :
                                         isUnchanged ? <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded font-medium border border-zinc-700">Unchanged</span> :
                                         <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded font-medium border border-amber-400/20">Modified</span>}
                                    </div>
                                    <div className="overflow-y-auto max-h-[60vh] w-full bg-[#0d1117]">
                                        {oldArt && !isUnchanged ? (
                                            <div className="flex flex-col min-w-full text-[12px] font-mono leading-relaxed">
                                                <div className="flex w-full sticky top-0 z-10 divide-x divide-zinc-800 shadow-md">
                                                    <div className="w-1/2 bg-[#2a1315] text-red-400/80 px-4 py-2 border-b border-zinc-800 uppercase tracking-widest font-sans font-bold text-[10px]">Main Branch (Old)</div>
                                                    <div className="w-1/2 bg-[#102a1b] text-emerald-400/80 px-4 py-2 border-b border-zinc-800 uppercase tracking-widest font-sans font-bold text-[10px]">This Timeline (New)</div>
                                                </div>
                                                {sbsRows.map((r, i) => (
                                                    <div key={i} className="flex w-full divide-x divide-zinc-800 hover:bg-zinc-800/50">
                                                        <div className={`w-1/2 flex px-2 py-0.5 ${r.leftType === 'removed' ? 'bg-red-900/30 text-red-300' : 'text-zinc-400'} ${r.leftType === 'empty' ? 'bg-[#0d1117] select-none' : ''}`}>
                                                            <span className="w-10 shrink-0 text-zinc-600 text-right pr-3 select-none opacity-50 border-r border-zinc-800/50 mr-3">{r.leftNum || ''}</span>
                                                            <span className="whitespace-pre-wrap break-all w-full">{r.leftCode}</span>
                                                        </div>
                                                        <div className={`w-1/2 flex px-2 py-0.5 ${r.rightType === 'added' ? 'bg-emerald-900/30 text-emerald-300' : 'text-zinc-300'} ${r.rightType === 'empty' ? 'bg-[#0d1117] select-none' : ''}`}>
                                                            <span className="w-10 shrink-0 text-zinc-600 text-right pr-3 select-none opacity-50 border-r border-zinc-800/50 mr-3">{r.rightNum || ''}</span>
                                                            <span className="whitespace-pre-wrap break-all w-full">{r.rightCode}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={`p-4 font-mono text-[12px] text-zinc-300 whitespace-pre-wrap break-words ${isNew ? "bg-[#102a1b]/10" : ""}`}>
                                                {art.code}
                                            </div>
                                        )}
                                    </div>
                               </div>
                           );
                        })}
                     </div>
                  )}
               </div>
           )}
        </div>
        <div className="p-5 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
           <button onClick={onClose} className="px-5 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 font-medium transition-colors">Cancel</button>
           <button onClick={onConfirm} disabled={loading || isDiffLoading} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin"/> : <GitMerge size={16} />} Squash and Merge
           </button>
        </div>
      </div>
    </div>
  );
}