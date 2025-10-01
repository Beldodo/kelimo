import { createContext, useContext, useRef } from 'react';

export const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const socketRef = useRef(null);

  if (!socketRef.current) {
    socketRef.current = new WebSocket('ws://localhost:3001');
  }

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}
