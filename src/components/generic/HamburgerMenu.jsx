import React, { useState, useEffect } from 'react';
import { authClient } from "src/lib/auth-client";

const HamburgerIcon = () => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="4" y1="14" x2="24" y2="14"></line>
        <line x1="4" y1="7" x2="24" y2="7"></line>
        <line x1="4" y1="21" x2="24" y2="21"></line>
    </svg>
);

const HamburgerMenu = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { data: session, isPending } = authClient.useSession();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target.closest('.hamburger-menu') === null) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = async () => {
        await authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    window.location.href = '/';
                },
            },
        });
    };

    const menuItemStyle = {
        display: 'block',
        padding: '0.75rem 1rem',
        textDecoration: 'none',
        color: 'black',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease',
        width: '100%',
        textAlign: 'left',
        border: 'none',
        background: 'none',
        fontSize: '1rem',
        fontWeight: 'bold',
    };

    const buttonClassName = React.useMemo(() => {
        const baseClass = 'hamburger-button';
        return isPending ? `${baseClass} pending` : baseClass;
    }, [isPending]);

    return (
        <>
            <style>
                {`
                    .hamburger-button {
                        background-color: black;
                        color: white;
                        display: inline-flex;
                        justify-content: center;
                        align-items: center;
                        padding: 0.5rem;
                        border: none;
                        font-weight: bold;
                        width: 48px;
                        height: 48px;
                        text-align: center;
                        cursor: pointer;
                        transition: background-color 0.3s ease;
                        border-radius: 4px;
                    }

                    .hamburger-button.pending {
                        background-color: #333;
                        cursor: default;
                    }
                `}
            </style>
            <div className="hamburger-menu" style={{ position: 'relative' }}>
                <button
                    onClick={() => !isPending && setIsOpen(!isOpen)}
                    className={buttonClassName}
                    aria-label="Menu"
                    disabled={isPending}
                >
                    <HamburgerIcon />
                </button>

                {isOpen && !isPending && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            backgroundColor: 'white',
                            border: '2px solid black',
                            borderRadius: '4px',
                            marginTop: '5px',
                            zIndex: 1000,
                            width: '200px',
                        }}
                    >
                        {!session ? (
                            // Unauthenticated Menu Items
                            <>
                                <a
                                    href="/signin"
                                    style={menuItemStyle}
                                    onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                >
                                    Login
                                </a>
                                <a
                                    href="/createprofile"
                                    style={menuItemStyle}
                                    onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                >
                                    Register
                                </a>
                                <a
                                    href="/events"
                                    style={menuItemStyle}
                                    onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                >
                                    Events
                                </a>
                            </>
                        ) : (
                            // Authenticated Menu Items
                            <>
                                <a
                                    href="/profile"
                                    style={menuItemStyle}
                                    onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                >
                                    My Profile
                                </a>
                                <a
                                    href="/friends"
                                    style={menuItemStyle}
                                    onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                >
                                    Friends
                                </a>

                                <a
                                    href="/bookings"
                                    style={menuItemStyle}
                                    onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                >
                                    My Events
                                </a>
                                <a
                                    href="/events"
                                    style={menuItemStyle}
                                    onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                >
                                    Browse Events
                                </a>
                                <button
                                    onClick={handleLogout}
                                    style={menuItemStyle}
                                    onMouseOver={e => e.target.style.backgroundColor = '#f0f0f0'}
                                    onMouseOut={e => e.target.style.backgroundColor = 'transparent'}
                                >
                                    Logout
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default HamburgerMenu; 