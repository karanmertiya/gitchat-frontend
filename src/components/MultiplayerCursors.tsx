import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MousePointer2 } from 'lucide-react';

export default function MultiplayerCursors({ workspaceId, user }: { workspaceId: string, user: any }) {
    const [cursors, setCursors] = useState<{ [key: string]: { x: number, y: number, name: string, color: string } }>({});

    useEffect(() => {
        if (!workspaceId || !user) return;

        // Generate a stable, random color for this user based on their ID
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'];
        const myColor = colors[user.id.charCodeAt(0) % colors.length];
        const myName = user.user_metadata?.full_name || user.email.split('@')[0];

        const room = supabase.channel(`cursors:${workspaceId}`, {
            config: { presence: { key: user.id } }
        });

        room.on('presence', { event: 'sync' }, () => {
            const state = room.presenceState();
            const newCursors: any = {};
            for (const id in state) {
                if (id !== user.id) { // Don't render our own cursor
                    // @ts-ignore
                    newCursors[id] = state[id][0];
                }
            }
            setCursors(newCursors);
        });

        room.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await room.track({ x: -100, y: -100, name: myName, color: myColor });
            }
        });

        // Throttle mouse moves to 50ms to save Supabase API calls
        let lastMove = 0;
        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastMove > 50) {
                room.track({ x: e.clientX, y: e.clientY, name: myName, color: myColor });
                lastMove = now;
            }
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            supabase.removeChannel(room);
        };
    }, [workspaceId, user]);

    return (
        <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
            {Object.values(cursors).map((cursor, i) => (
                <div 
                    key={i} 
                    className="absolute flex flex-col items-start transition-all duration-75 ease-linear"
                    style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
                >
                    <MousePointer2 
                        size={20} 
                        fill={cursor.color} 
                        color="white" 
                        strokeWidth={2} 
                        className="drop-shadow-md -rotate-12"
                    />
                    <div 
                        className="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md whitespace-nowrap"
                        style={{ backgroundColor: cursor.color }}
                    >
                        {cursor.name}
                    </div>
                </div>
            ))}
        </div>
    );
}