import React, { useState } from 'react';
import Papa from 'papaparse';
import { Database, Upload, Wand2, X, CheckCircle, Trash, RefreshCw, File as FileIcon } from 'lucide-react';
import toast from 'react-hot-toast';

interface DataCleaningStudioProps {
    isOpen: boolean;
    onClose: () => void;
    onInjectCleanedData: (filename: string, content: string) => void;
}

export default function DataCleaningStudio({ isOpen, onClose, onInjectCleanedData }: DataCleaningStudioProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    
    // Cleaning Config
    const [dropDuplicates, setDropDuplicates] = useState(false);
    const [trimWhitespace, setTrimWhitespace] = useState(true);
    const [lowercaseText, setLowercaseText] = useState(false);
    const [imputeNulls, setImputeNulls] = useState<'none' | 'drop' | 'zero' | 'mean' | 'median'>('none');
    const [imputeColumns, setImputeColumns] = useState<string[]>([]);
    const [isCleaning, setIsCleaning] = useState(false);

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;
        setFile(uploadedFile);

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target?.result as string;
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    setParsedData(results.data);
                    if (results.meta.fields) {
                        setColumns(results.meta.fields);
                    }
                },
                error: (error: any) => {
                    toast.error(`Error parsing CSV: ${error.message}`);
                }
            });
        };
        reader.readAsText(uploadedFile);
    };

    const toggleColumn = (col: string) => {
        setImputeColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
    };

    const executeCleaning = async () => {
        if (parsedData.length === 0) return;
        setIsCleaning(true);
        const loadId = toast.loading('Running AI Data Cleaning Pipeline...');

        try {
            const payload = {
                data: parsedData,
                config: {
                    dropDuplicates,
                    trimWhitespace,
                    lowercaseText,
                    imputeNulls: imputeNulls !== 'none' ? imputeNulls : undefined,
                    imputeColumns: imputeColumns.length > 0 ? imputeColumns : undefined
                }
            };

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/clean-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.error || "Cleaning Failed");

            const newCsv = Papa.unparse(result.data);
            const originalName = file ? file.name.replace('.csv', '') : 'dataset';
            onInjectCleanedData(`${originalName}_cleaned.csv`, newCsv);

            toast.success(`Cleaned successfully! Reduced from ${result.originalRows} to ${result.cleanedRows} rows.`, { id: loadId });
            onClose();
        } catch (error: any) {
            toast.error(`Pipeline Failed: ${error.message}`, { id: loadId });
        } finally {
            setIsCleaning(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-2">
                        <Database className="text-indigo-400" size={20} />
                        <h2 className="text-lg font-bold text-white">Data Cleaning Studio</h2>
                    </div>
                    <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    {parsedData.length === 0 ? (
                        <div className="border-2 border-dashed border-zinc-700 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                            <div className="bg-indigo-600/20 p-4 rounded-full mb-4">
                                <Upload size={32} className="text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Upload Raw Dataset</h3>
                            <p className="text-sm text-zinc-400 mb-6">Supported formats: CSV. The data will be loaded into the studio for configuration.</p>
                            <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg cursor-pointer font-medium transition-colors flex items-center gap-2">
                                <FileIcon size={18} /> Browse Files
                                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                <div className="flex flex-col">
                                    <span className="text-white font-medium">{file?.name}</span>
                                    <span className="text-xs text-indigo-300">{parsedData.length} Rows • {columns.length} Columns</span>
                                </div>
                                <button onClick={() => { setFile(null); setParsedData([]); }} className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300">
                                    <Trash size={14} /> Remove
                                </button>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">General Cleaning</h3>
                                <label className="flex items-center gap-3 p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors">
                                    <input type="checkbox" className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 bg-zinc-900 border-zinc-700" checked={dropDuplicates} onChange={(e) => setDropDuplicates(e.target.checked)} />
                                    <div className="flex flex-col">
                                        <span className="text-sm text-white font-medium">Remove Duplicate Rows</span>
                                        <span className="text-xs text-zinc-400">Drops perfectly identical records.</span>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl cursor-pointer hover:bg-zinc-800 transition-colors">
                                    <input type="checkbox" className="w-4 h-4 rounded text-indigo-500 focus:ring-indigo-500 bg-zinc-900 border-zinc-700" checked={trimWhitespace} onChange={(e) => setTrimWhitespace(e.target.checked)} />
                                    <div className="flex flex-col">
                                        <span className="text-sm text-white font-medium">Trim Whitespace</span>
                                        <span className="text-xs text-zinc-400">Removes leading and trailing spaces from text columns.</span>
                                    </div>
                                </label>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-zinc-800">
                                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Handle Missing Values</h3>
                                <select 
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500"
                                    value={imputeNulls} 
                                    onChange={(e) => setImputeNulls(e.target.value as any)}
                                >
                                    <option value="none">Ignore missing values</option>
                                    <option value="drop">Drop rows with missing values</option>
                                    <option value="zero">Fill with Zero (0)</option>
                                    <option value="mean">Impute with Mean (Average)</option>
                                    <option value="median">Impute with Median</option>
                                </select>

                                {imputeNulls !== 'none' && columns.length > 0 && (
                                    <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-xl">
                                        <span className="text-xs text-zinc-400 block mb-3">Select Target Columns:</span>
                                        <div className="flex flex-wrap gap-2">
                                            {columns.map(col => (
                                                <button
                                                    key={col}
                                                    onClick={() => toggleColumn(col)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${imputeColumns.includes(col) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                                                >
                                                    {col}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {parsedData.length > 0 && (
                    <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white font-medium">Cancel</button>
                        <button 
                            onClick={executeCleaning} 
                            disabled={isCleaning}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            {isCleaning ? <RefreshCw size={16} className="animate-spin" /> : <Wand2 size={16} />}
                            {isCleaning ? 'Processing...' : 'Run Pipeline'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
