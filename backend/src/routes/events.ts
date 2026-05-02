// Server-Sent-Events. Ein Stream pro Browser-Tab, alle Bus-Events landen hier.
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { onAny, type AppEvent } from "../events/bus.js";
import { isMaintenance } from "../backup/maintenance.js";

interface BufferedEvent {
  id: number;
  type: string;
  data: string;
}

const RING_SIZE = 200;
const ring: BufferedEvent[] = [];
let nextId = 1;

function pushToRing(ev: AppEvent): BufferedEvent {
  const buffered: BufferedEvent = {
    id: nextId++,
    type: ev.type,
    data: JSON.stringify(ev.payload),
  };
  ring.push(buffered);
  if (ring.length > RING_SIZE) ring.shift();
  return buffered;
}

interface ClientHandle {
  userId: string;
  ip: string;
  reply: FastifyReply;
}

const clientsByUser = new Map<string, ClientHandle[]>();
const clientsByIp = new Map<string, number>();
const MAX_PER_USER = 10;
const MAX_PER_IP = 5;

let busSubscribed = false;

function ensureBusSubscription(): void {
  if (busSubscribed) return;
  busSubscribed = true;
  onAny((ev) => {
    const buf = pushToRing(ev);
    for (const list of clientsByUser.values()) {
      for (const c of list) {
        try {
          c.reply.raw.write(`id: ${buf.id}\nevent: ${buf.type}\ndata: ${buf.data}\n\n`);
        } catch { /* connection broken, cleanup runs on close */ }
      }
    }
  });
}

function writeFrame(reply: FastifyReply, type: string, data: unknown): void {
  reply.raw.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

function addClient(userId: string, ip: string, reply: FastifyReply): boolean {
  const userList = clientsByUser.get(userId) ?? [];
  if (userList.length >= MAX_PER_USER) {
    // FIFO-Drop
    const oldest = userList.shift();
    try { oldest?.reply.raw.end(); } catch { /* noop */ }
  }
  const ipCount = clientsByIp.get(ip) ?? 0;
  if (ipCount >= MAX_PER_IP) return false;
  userList.push({ userId, ip, reply });
  clientsByUser.set(userId, userList);
  clientsByIp.set(ip, ipCount + 1);
  return true;
}

function removeClient(userId: string, ip: string, reply: FastifyReply): void {
  const userList = clientsByUser.get(userId);
  if (userList) {
    const idx = userList.findIndex((c) => c.reply === reply);
    if (idx >= 0) userList.splice(idx, 1);
    if (userList.length === 0) clientsByUser.delete(userId);
  }
  const ipCount = clientsByIp.get(ip) ?? 0;
  if (ipCount <= 1) clientsByIp.delete(ip);
  else clientsByIp.set(ip, ipCount - 1);
}

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  ensureBusSubscription();

  app.get("/events/stream", {
    preHandler: requireAuth,
    config: { rateLimit: false },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user!.id;
    const ip = req.ip;

    reply.hijack();
    const raw = reply.raw;
    raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    raw.setHeader("Cache-Control", "no-cache, no-transform");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    raw.setHeader("Content-Encoding", "identity");
    raw.flushHeaders?.();

    if (isMaintenance()) {
      raw.write(`event: maintenance\ndata: {"active":true}\n\n`);
      raw.end();
      return;
    }

    const ok = addClient(userId, ip, reply);
    if (!ok) {
      raw.write(`event: error\ndata: {"error":"too_many_connections"}\n\n`);
      raw.end();
      return;
    }

    raw.write(`event: hello\ndata: ${JSON.stringify({ serverTime: new Date().toISOString(), lastEventId: nextId - 1 })}\n\n`);

    // Replay verpasster Events via Last-Event-ID Header
    const lastIdHeader = req.headers["last-event-id"];
    const lastId = Array.isArray(lastIdHeader) ? Number(lastIdHeader[0]) : Number(lastIdHeader);
    if (Number.isFinite(lastId) && lastId > 0) {
      for (const ev of ring) {
        if (ev.id > lastId) {
          raw.write(`id: ${ev.id}\nevent: ${ev.type}\ndata: ${ev.data}\n\n`);
        }
      }
    }

    const heartbeat = setInterval(() => {
      try { raw.write(": ping\n\n"); } catch { /* ignore */ }
    }, 25_000);
    heartbeat.unref?.();

    const cleanup = (): void => {
      clearInterval(heartbeat);
      removeClient(userId, ip, reply);
    };

    raw.on("close", cleanup);
    raw.on("error", cleanup);
  });
}

// Test-Hilfsfunktionen
export function _sseClientCount(): number {
  let n = 0;
  for (const list of clientsByUser.values()) n += list.length;
  return n;
}
export function _sseRingSize(): number { return ring.length; }
