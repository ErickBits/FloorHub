import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { session } from './api.js';

const HEARTBEAT_MS = 15000;

// Crea la conexión de la sesión. onConnect recarga el estado por REST porque Redis Pub/Sub
// no guarda lo que se emitió mientras el cliente estaba desconectado.
export function useSocket(handlers, onConnect) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  const onConnectRef = useRef(onConnect);

  useEffect(() => {
    handlersRef.current = handlers;
    onConnectRef.current = onConnect;
  });

  useEffect(() => {
    const socket = io({
      path: '/ws',
      transports: ['websocket'],
      auth: { token: session.token },
    });
    let heartbeat;

    socket.on('connect', () => {
      setConnected(true);
      onConnectRef.current?.();
      heartbeat = setInterval(() => socket.emit('presence:heartbeat'), HEARTBEAT_MS);
    });
    socket.on('disconnect', (reason) => {
      setConnected(false);
      clearInterval(heartbeat);
      // El servidor cierra la conexión cuando cambian los permisos: hay que volver a entrar a las salas.
      if (reason === 'io server disconnect') socket.connect();
    });
    socket.on('connect_error', () => setConnected(false));
    socket.onAny((event, payload) => handlersRef.current[event]?.(payload));

    return () => {
      clearInterval(heartbeat);
      socket.disconnect();
    };
  }, []);

  return connected;
}
