import React, { useEffect } from 'react';
import { authClient } from "src/lib/auth-client";

const Dropdown = ({ onClose }) => {
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target.closest('.profile-dropdown') === null) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const handleLogout = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    window.location.href = '/';
                },
            },
        });
    };

    const linkStyle = {
        display: 'block',
        padding: '0.5rem 1rem',
        textDecoration: 'none',
        color: 'black',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
    };

    return (
        <div
            className="profile-dropdown"
            style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: 'white',
                border: '2px solid black',
                borderRadius: '4px',
                padding: '0.5rem',
                marginTop: '5px',
                zIndex: 1000,
                width: 'max-content'
            }}
        >
            <a
                href="/profile"
                style={linkStyle}
                onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
            >
                My Profile
            </a>
            <a
                href="/friends"
                style={linkStyle}
                onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseOut={e => e.target.style.backgroundColor = 'transparent'}            >
                Friends
            </a>
            <a
                href="/bookings"
                style={linkStyle}
                onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
            >
                My Events
            </a>
            <a
                onClick={handleLogout}
                style={linkStyle}
                onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
            >
                Logout
            </a>
        </div>
    );
};

export default Dropdown; 