/**
 * Bun WebSocket Server Entry Point
 * Handles WebSocket connections and routes messages to game rooms
 */

import { GameRoom } from './GameRoom';
import type { JoinMessage } from '../shared/protocol';
import { isClientMessage } from '../shared/protocol';

// Room management
const rooms: Map<string, GameRoom> = new Map();

// Generate a random 4-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Get or create a room
function getOrCreateRoom(roomCode?: string): GameRoom {
  // If no room code, create a new room
  if (!roomCode) {
    let code: string;
    do {
      code = generateRoomCode();
    } while (rooms.has(code));
    
    const room = new GameRoom(code);
    rooms.set(code, room);
    console.log(`[Server] Created new room: ${code}`);
    return room;
  }
  
  // Try to get existing room
  const existing = rooms.get(roomCode.toUpperCase());
  if (existing) {
    return existing;
  }
  
  // Create new room with specified code
  const room = new GameRoom(roomCode.toUpperCase());
  rooms.set(roomCode.toUpperCase(), room);
  console.log(`[Server] Created new room: ${roomCode.toUpperCase()}`);
  return room;
}

// Clean up empty rooms periodically
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.isEmpty()) {
      room.stop();
      rooms.delete(code);
      console.log(`[Server] Removed empty room: ${code}`);
    }
  }
}, 30000); // Check every 30 seconds

// WebSocket data type
interface WebSocketData {
  playerId: string;
  roomCode: string;
}

const PORT = parseInt(process.env.PORT || '3001', 10);

console.log(`[Server] Starting WebSocket server on port ${PORT}...`);

const server = Bun.serve<WebSocketData>({
  port: PORT,
  
  fetch(req, server) {
    const url = new URL(req.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        rooms: rooms.size,
        uptime: process.uptime(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Room list endpoint
    if (url.pathname === '/rooms') {
      const roomList = Array.from(rooms.values()).map(r => r.getInfo());
      return new Response(JSON.stringify(roomList), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // WebSocket upgrade
    if (url.pathname === '/ws') {
      const roomCode = url.searchParams.get('room') || undefined;
      const displayName = url.searchParams.get('name') || 'Player';
      
      // Generate player ID
      const playerId = crypto.randomUUID();
      
      const upgraded = server.upgrade(req, {
        data: {
          playerId,
          roomCode: roomCode || '',
          displayName,
        } as WebSocketData & { displayName: string },
      });
      
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 500 });
      }
      
      return undefined;
    }
    
    // Serve a simple info page for other requests
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head><title>Game Server</title></head>
        <body>
          <h1>WebSocket Game Server</h1>
          <p>Connect via WebSocket at: ws://localhost:${PORT}/ws</p>
          <p>Endpoints:</p>
          <ul>
            <li>GET /health - Server health check</li>
            <li>GET /rooms - List active rooms</li>
            <li>WS /ws?room=CODE&name=NAME - Connect to game</li>
          </ul>
          <p>Active rooms: ${rooms.size}</p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });
  },
  
  websocket: {
    open(ws) {
      const data = ws.data as WebSocketData & { displayName?: string };
      const displayName = data.displayName || 'Player';
      
      console.log(`[Server] WebSocket opened for player ${data.playerId}`);
      
      // Get or create room
      const room = getOrCreateRoom(data.roomCode || undefined);
      data.roomCode = room.roomCode;
      
      // Add player to room
      room.addPlayer(ws, data.playerId, displayName);
    },
    
    message(ws, message) {
      const data = ws.data as WebSocketData;
      
      try {
        const parsed = JSON.parse(message.toString());
        
        if (!isClientMessage(parsed)) {
          console.warn(`[Server] Invalid message from ${data.playerId}:`, parsed);
          return;
        }
        
        // Handle join message specially (room assignment)
        if (parsed.type === 'join') {
          const joinMsg = parsed as JoinMessage;
          const room = getOrCreateRoom(joinMsg.roomCode);
          
          // Remove from current room if different
          if (data.roomCode && data.roomCode !== room.roomCode) {
            const oldRoom = rooms.get(data.roomCode);
            oldRoom?.removePlayer(data.playerId);
          }
          
          data.roomCode = room.roomCode;
          room.addPlayer(ws, data.playerId, joinMsg.displayName);
          return;
        }
        
        // Route message to room
        const room = rooms.get(data.roomCode);
        if (room) {
          room.handleMessage(data.playerId, parsed);
        }
      } catch (error) {
        console.error(`[Server] Failed to parse message from ${data.playerId}:`, error);
      }
    },
    
    close(ws) {
      const data = ws.data as WebSocketData;
      
      console.log(`[Server] WebSocket closed for player ${data.playerId}`);
      
      // Remove from room
      const room = rooms.get(data.roomCode);
      if (room) {
        room.removePlayer(data.playerId);
      }
    },
    
    drain(ws) {
      // Handle backpressure if needed
      console.log(`[Server] WebSocket drain event for ${ws.data.playerId}`);
    },
  },
});

console.log(`[Server] WebSocket server listening on port ${server.port}`);
console.log(`[Server] Health check: http://localhost:${server.port}/health`);
console.log(`[Server] Room list: http://localhost:${server.port}/rooms`);
console.log(`[Server] WebSocket: ws://localhost:${server.port}/ws`);
