import type { FastifyReply } from "fastify";

interface SseClient {
  userId: string;
  role: string;
  reply: FastifyReply;
}

const clients = new Map<string, SseClient>();

export function addSseClient(connectionId: string, client: SseClient): void {
  clients.set(connectionId, client);
}

export function removeSseClient(connectionId: string): void {
  clients.delete(connectionId);
}

export function broadcastToUser(userId: string, event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.userId === userId) {
      sendSseEvent(client.reply, event, data);
    }
  }
}

export function broadcastToRole(minRole: string, event: string, data: unknown): void {
  for (const client of clients.values()) {
    if (client.role === "admin" || client.role === "moderator") {
      sendSseEvent(client.reply, event, data);
    }
  }
}

export function broadcastToAll(event: string, data: unknown): void {
  for (const client of clients.values()) {
    sendSseEvent(client.reply, event, data);
  }
}

export function getSseHealthInfo(): { connectedClients: number } {
  return { connectedClients: clients.size };
}

function sendSseEvent(reply: FastifyReply, event: string, data: unknown): void {
  try {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client disconnected
  }
}
