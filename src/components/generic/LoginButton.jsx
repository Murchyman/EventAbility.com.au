import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { authClient } from "src/lib/auth-client";

// Preload components immediately
const ChatButton = lazy(() => {
  const preload = import('./ChatButton');
  return preload;
});
const Dropdown = lazy(() => {
  const preload = import('./Dropdown');
  return preload;
});

// Preload both components
if (typeof window !== 'undefined') {
  const preloadComponents = () => {
    const chatPromise = import('./ChatButton');
    const dropdownPromise = import('./Dropdown');
    Promise.all([chatPromise, dropdownPromise]);
  };
  preloadComponents();
}

// Simplified mobile hook with debouncing
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    let timeoutId;
    const checkMobile = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth <= 768);
      }, 100);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(timeoutId);
    };
  }, []);

  return isMobile;
};

const LoginButton = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const isMobile = useIsMobile();
  const {
    data: session,
    isPending,
  } = authClient.useSession();

  const buttonStyle = {
    color: 'white',
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "0.75rem 1rem",
    border: 'none',
    fontWeight: 'bold',
    width: "100px",
    textAlign: "center",
    textDecoration: "none",
    cursor: isPending ? "default" : "pointer",
    transition: "background-color 0.3s ease",
    borderRadius: "4px",
    boxSizing: "border-box",
    backgroundColor: isPending ? "#333" : "black",
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

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = '/';
        },
      },
    });
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={dropdownRef}>
      <>
        {!isMobile && session && (
          <Suspense fallback={
            <div style={{
              width: "48px",
              height: "48px",
              marginRight: "10px",
              backgroundColor: 'black',
              borderRadius: "4px",
            }} />
          }>
            <ChatButton />
          </Suspense>
        )}
        <div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isPending) {
                setShowDropdown(prev => !prev);
              }
            }}
            style={buttonStyle}
            disabled={isPending}
          >
            Account
          </button>
          {showDropdown && !isPending && (
            <Suspense fallback={
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: 'white',
                border: '2px solid black',
                borderRadius: '4px',
                padding: '0.5rem',
                marginTop: '5px',
                width: '200px',
                minHeight: '150px',
              }}
              />
            }>
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                backgroundColor: 'white',
                border: '2px solid black',
                borderRadius: '4px',
                marginTop: '5px',
                zIndex: 1000,
                width: '200px',
              }}>
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
                      onMouseOut={e => e.target.style.backgroundColor = 'transparent'}                    >
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
            </Suspense>
          )}
        </div>
      </>
    </div>
  );
};

export default LoginButton;