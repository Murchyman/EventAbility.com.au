import React, { useState, useEffect } from 'react';
import { authClient } from "src/lib/auth-client";

const ChatIcon = () => (
    <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
    >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const ChatButton = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const { data: session } = authClient.useSession();

    useEffect(() => {
        let mounted = true;

        const fetchUnreadCount = async () => {
            if (!session) return;

            try {
                const response = await fetch('/api/chat/unreadCount', {
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                if (response.ok && mounted) {
                    const data = await response.json();
                    setUnreadCount(data.count);
                }
            } catch (error) {
                console.error('Failed to fetch unread chats count:', error);
            }
        };

        if (session) {
            fetchUnreadCount();
            const interval = setInterval(fetchUnreadCount, 30000);

            return () => {
                mounted = false;
                clearInterval(interval);
            };
        }
    }, [session]);

    if (!session) return null;

    return (
        <a
            href="/chats"
            style={{
                width: "48px",
                height: "48px",
                marginRight: "10px",
                padding: "0",
                minWidth: "48px",
                maxWidth: "48px",
                boxSizing: "border-box",
                borderRadius: "4px",
                backgroundColor: 'black',
                color: 'white',
                border: 'none',
                transition: 'opacity 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.opacity = '0.9';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.opacity = '1';
            }}
        >
            <ChatIcon />
            {
                unreadCount > 0 && (
                    <span
                        style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-10px',
                            backgroundColor: '#ff4444',
                            color: 'white',
                            borderRadius: '50%',
                            minWidth: '18px',
                            height: '18px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            border: '1.5px solid black',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                            pointerEvents: 'none'
                        }}
                    >
                        {unreadCount}
                    </span>
                )
            }
        </a >
    );
};

export default ChatButton; 