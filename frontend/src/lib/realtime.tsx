import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../stores/auth';

const SocketContext = createContext<Socket | null>(null);

/** One authenticated Socket.IO connection per access token (reconnects when the token rotates). */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.accessToken);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const s = io('/realtime', { auth: { token }, transports: ['websocket'] });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Subscribe to a server event for as long as the component is mounted. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const socket = useSocket();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => latest.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
