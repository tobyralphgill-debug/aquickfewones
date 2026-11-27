// Friend matches on any network. A public broker only introduces the two browsers.
// The match itself goes over an encrypted WebRTC data channel, so it is not stuck
// on one Wi-Fi or on the computer that opened the room.

const BROKERS = [
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt",
];

const ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const PUBLIC_SITE = "https://tobyralphgill-debug.github.io/aquickfewones/";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const textEncode = new TextEncoder();
const textDecode = new TextDecoder();

export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function makeToken(length) {
  const values = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(values);
  else for (let i = 0; i < length; i += 1) values[i] = Math.floor(Math.random() * 256);
  let out = "";
  for (let i = 0; i < length; i += 1) out += CODE_CHARS[values[i] % CODE_CHARS.length];
  return out;
}

function concat(parts) {
  let length = 0;
  for (const part of parts) length += part.length;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(value) {
  return new Uint8Array([(value >> 8) & 255, value & 255]);
}

function packet(type, body) {
  const length = [];
  let left = body.length;
  do {
    let digit = left % 128;
    left = Math.floor(left / 128);
    if (left > 0) digit |= 128;
    length.push(digit);
  } while (left > 0);
  const out = new Uint8Array(1 + length.length + body.length);
  out[0] = type;
  out.set(length, 1);
  out.set(body, 1 + length.length);
  return out;
}

export function encodeConnect(clientId) {
  const id = textEncode.encode(clientId);
  const body = concat([
    new Uint8Array([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x1e]),
    u16(id.length),
    id,
  ]);
  return packet(0x10, body);
}

export function encodeSubscribe(id, topic) {
  const name = textEncode.encode(topic);
  return packet(0x82, concat([u16(id), u16(name.length), name, new Uint8Array([0])]));
}

export function encodePublish(topic, payload, retain) {
  const name = textEncode.encode(topic);
  const body = textEncode.encode(payload);
  return packet(retain ? 0x31 : 0x30, concat([u16(name.length), name, body]));
}

export function encodePing() {
  return new Uint8Array([0xc0, 0x00]);
}

function encodeDisconnect() {
  return new Uint8Array([0xe0, 0x00]);
}

function readString(body, offset) {
  if (offset + 2 > body.length) return null;
  const length = (body[offset] << 8) | body[offset + 1];
  const start = offset + 2;
  const end = start + length;
  if (end > body.length) return null;
  return { text: textDecode.decode(body.subarray(start, end)), next: end };
}

export function parsePackets(buffer) {
  const packets = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 2 > buffer.length) break;
    const first = buffer[offset];
    let value = 0;
    let multiplier = 1;
    let pos = offset + 1;
    let digits = 0;
    let byte = 0;
    do {
      if (pos >= buffer.length) return { packets, rest: buffer.slice(offset) };
      byte = buffer[pos];
      pos += 1;
      value += (byte & 127) * multiplier;
      multiplier *= 128;
      digits += 1;
      if (digits > 4) return { packets, rest: buffer.slice(offset) };
    } while (byte & 128);
    if (pos + value > buffer.length) return { packets, rest: buffer.slice(offset) };
    packets.push(decodePacket(first, buffer.slice(pos, pos + value)));
    offset = pos + value;
  }
  return { packets, rest: buffer.slice(offset) };
}

function decodePacket(first, body) {
  const kind = first >> 4;
  const packet = { type: "other", kind };
  if (kind === 2) {
    packet.type = "connack";
    packet.returnCode = body[1] || 0;
    return packet;
  }
  if (kind === 3) {
    const topic = readString(body, 0);
    packet.type = "publish";
    packet.retain = Boolean(first & 1);
    if (!topic) return packet;
    let next = topic.next;
    const qos = (first >> 1) & 3;
    if (qos > 0) next += 2;
    packet.topic = topic.text;
    packet.payload = textDecode.decode(body.subarray(Math.min(next, body.length)));
    return packet;
  }
  if (kind === 9) packet.type = "suback";
  else if (kind === 12) packet.type = "pingreq";
  else if (kind === 13) packet.type = "pingresp";
  return packet;
}

export function mqttCodecCheck() {
  const topic = "aqfo/v1/TEST";
  const payload = JSON.stringify({ v: 1, kind: "host", from: "ABC", t: 1, pad: "x".repeat(180) });
  const published = encodePublish(topic, payload, true);
  if (published[0] !== 0x31) return { ok: false, reason: "retain flag missing" };
  if (encodeSubscribe(7, topic)[0] !== 0x82) return { ok: false, reason: "subscribe packet" };
  if (encodeConnect("aqCLIENT123")[0] !== 0x10) return { ok: false, reason: "connect packet" };
  const blob = concat([published, encodePing(), published]);
  const partial = parsePackets(blob.slice(0, 5));
  if (partial.packets.length !== 0 || partial.rest.length !== 5) return { ok: false, reason: "partial packet" };
  const full = parsePackets(concat([partial.rest, blob.slice(5)]));
  if (full.packets.length !== 3 || full.rest.length !== 0) return { ok: false, reason: "split reassembly" };
  const first = full.packets[0];
  if (first.type !== "publish" || first.topic !== topic || first.payload !== payload || !first.retain) {
    return { ok: false, reason: "publish roundtrip" };
  }
  if (full.packets[1].type !== "pingreq") return { ok: false, reason: "ping packet" };
  if (readRoomCode("https://example.com/aquickfewones/?room=k7qp") !== "K7QP") {
    return { ok: false, reason: "room code parse" };
  }
  return { ok: true, reason: "" };
}

function isPrivateHost(host) {
  const name = String(host || "").toLowerCase();
  if (name === "localhost" || name === "127.0.0.1" || name === "::1" || name === "[::1]") return true;
  const parts = name.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168)) return true;
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

export function webAvailable() {
  return typeof RTCPeerConnection === "function"
    && typeof WebSocket === "function"
    && (typeof window === "undefined" || window.isSecureContext !== false);
}

export function readRoomCode(raw) {
  const text = String(raw || "").trim();
  const link = text.match(/[?&]room=([A-Za-z0-9]+)/i);
  const source = link ? link[1] : text;
  return source.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export function inviteLink(code) {
  let base = PUBLIC_SITE;
  if (typeof location !== "undefined" && location.hostname && !isPrivateHost(location.hostname)) {
    const here = new URL(location.href);
    here.search = "";
    here.hash = "";
    base = here.toString();
  }
  const url = new URL(base);
  url.searchParams.set("room", code);
  return url.toString();
}

function fresh(time) {
  if (typeof time !== "number") return true;
  const age = Date.now() - time;
  return age < 120000 && age > -120000;
}

function waitIce(pc, ms) {
  if (!pc || pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onState);
      resolve();
    };
    const onState = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const timer = setTimeout(done, ms);
    pc.addEventListener("icegatheringstatechange", onState);
  });
}

const OFFLINE = "Could not reach the match service. Check your connection and try again.";
const CONNECT_FAIL = "Could not connect to your friend. Try again. Some networks block the direct link.";

export class InternetRoom {
  constructor() {
    this.peerId = makeToken(12);
    this.clientId = `aq${makeToken(10)}`.slice(0, 23);
    this.code = "";
    this.role = "";
    this.otherId = "";
    this.ws = null;
    this.pc = null;
    this.channel = null;
    this.buffer = new Uint8Array(0);
    this.pendingIce = [];
    this.closed = false;
    this.linked = false;
    this.sawHost = false;
    this.remoteSet = false;
    this.answering = false;
    this.offering = false;
    this.onmessage = () => {};
    this.onopen = () => {};
    this.onclose = () => {};
    this.onstatus = () => {};
  }

  topic() {
    return `aqfo/v1/${this.code}`;
  }

  async host() {
    this.role = "host";
    this.code = makeToken(4);
    this.onstatus("Opening a room...");
    await this.connect();
    if (this.closed) throw new RoomError("closed", "Room closed.");
    this.publishBeacon();
    this.hostTimer = setInterval(() => this.publishBeacon(), 15000);
    this.onstatus("Waiting for your friend. Send the code or the link. Different Wi-Fi works.");
    return this.code;
  }

  async join(code) {
    this.role = "guest";
    this.code = readRoomCode(code);
    if (this.code.length < 4) throw new RoomError("missing", "Enter the room code.");
    this.onstatus("Looking for that room...");
    await this.connect();
    if (this.closed) throw new RoomError("closed", "Room closed.");
    await this.waitFor("host", 8000, new RoomError("missing", "No room with that code."));
    if (this.closed) throw new RoomError("closed", "Room closed.");
    this.helloTimer = setInterval(() => this.publish({ kind: "hello" }), 1500);
    this.publish({ kind: "hello" });
    this.onstatus("Found your friend. Connecting...");
    await this.waitFor("link", 15000, new RoomError("timeout", CONNECT_FAIL));
  }

  send(payload) {
    if (!this.channel || this.channel.readyState !== "open") return false;
    if (this.channel.bufferedAmount > 250000) return false;
    this.channel.send(JSON.stringify(payload));
    return true;
  }

  close() {
    if (this.closed) return;
    const wasLinked = this.linked;
    this.closed = true;
    this.linked = false;
    clearInterval(this.helloTimer);
    clearInterval(this.hostTimer);
    clearInterval(this.pingTimer);
    this.rejectWaiters(new RoomError("closed", "Room closed."));
    if (this.role === "host" && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(encodePublish(this.topic(), "", true)); } catch (error) { /* already leaving */ }
    }
    if (this.channel) {
      try { this.channel.close(); } catch (error) { /* already closed */ }
    }
    if (this.pc) {
      try { this.pc.close(); } catch (error) { /* already closed */ }
    }
    this.dropSocket();
    if (wasLinked) this.onclose();
  }

  async connect() {
    let last = new RoomError("offline", OFFLINE);
    for (const url of BROKERS) {
      if (this.closed) throw new RoomError("closed", "Room closed.");
      try {
        await this.openSocket(url);
        this.broker = url;
        return;
      } catch (error) {
        if (this.closed || error.code === "closed") throw error;
        last = error.code ? error : last;
        this.dropSocket();
      }
    }
    throw last;
  }

  openSocket(url) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this._connResolve = null;
        this._connReject = null;
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        finish(new RoomError("offline", OFFLINE));
        try { if (ws) ws.close(); } catch (error) { /* socket never opened */ }
      }, 7000);
      let ws;
      try {
        ws = new WebSocket(url, ["mqtt"]);
      } catch (error) {
        finish(new RoomError("offline", OFFLINE));
        return;
      }
      this.ws = ws;
      this.buffer = new Uint8Array(0);
      ws.binaryType = "arraybuffer";
      this._connResolve = () => finish();
      this._connReject = (error) => finish(error);
      ws.onopen = () => {
        if (this.ws !== ws) return;
        ws.send(encodeConnect(this.clientId));
      };
      ws.onmessage = (event) => {
        if (this.ws === ws) this.ingest(event.data);
      };
      ws.onerror = () => {
        if (this.ws === ws && !settled) finish(new RoomError("offline", OFFLINE));
      };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        if (!settled) finish(new RoomError("offline", OFFLINE));
        else if (!this.closed && !this.linked) this.fail(new RoomError("offline", "The match connection dropped. Try again."));
      };
    });
  }

  ingest(data) {
    try {
      const chunk = data instanceof Uint8Array ? data : new Uint8Array(data);
      this.buffer = concat([this.buffer, chunk]);
      const parsed = parsePackets(this.buffer);
      this.buffer = parsed.rest;
      for (const message of parsed.packets) this.onPacket(message);
    } catch (error) {
      this.fail(new RoomError("offline", OFFLINE));
    }
  }

  onPacket(message) {
    if (message.type === "connack") {
      if (message.returnCode !== 0) {
        if (this._connReject) this._connReject(new RoomError("offline", OFFLINE));
        return;
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(encodeSubscribe(1, this.topic()));
      }
      return;
    }
    if (message.type === "suback") {
      this.startPing();
      if (this._connResolve) this._connResolve();
      return;
    }
    if (message.type === "publish") this.onSignal(message.payload);
  }

  startPing() {
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(encodePing());
    }, 20000);
  }

  onSignal(raw) {
    if (!raw) {
      if (this.role === "guest" && !this.linked && !this.closed) {
        this.fail(new RoomError("missing", "No room with that code."));
      }
      return;
    }
    let message;
    try {
      message = JSON.parse(raw);
    } catch (error) {
      return;
    }
    if (!message || message.v !== 1 || message.from === this.peerId) return;
    if (message.to && message.to !== this.peerId) return;
    if (message.kind === "host") {
      if (!fresh(message.t)) return;
      this.sawHost = true;
      this.resolveWaiter("host");
      return;
    }
    if (message.kind === "full") {
      this.fail(new RoomError("full", "That room is full."));
      return;
    }
    if (message.kind === "hello" && this.role === "host") this.onHello(message);
    else if (message.kind === "offer" && this.role === "guest") this.onOffer(message);
    else if (message.kind === "answer" && this.role === "host") this.onAnswer(message);
    else if (message.kind === "ice") this.onIce(message);
  }

  onHello(message) {
    if ((this.linked || this.pc) && message.from !== this.otherId) {
      this.publish({ kind: "full", to: message.from });
      return;
    }
    this.otherId = message.from;
    if (!this.pc) this.startOffer();
  }

  async startOffer() {
    if (this.offering || this.closed) return;
    this.offering = true;
    this.onstatus("Friend joined. Connecting...");
    try {
      this.makePc();
      this.bindChannel(this.pc.createDataChannel("game"));
      const offer = await this.pc.createOffer();
      if (this.closed) return;
      await this.pc.setLocalDescription(offer);
      await waitIce(this.pc, 1800);
      if (this.closed) return;
      this.publish({ kind: "offer", to: this.otherId, sdp: this.pc.localDescription.sdp });
    } catch (error) {
      this.fail(new RoomError("timeout", CONNECT_FAIL));
    }
  }

  async onOffer(message) {
    if (this.answering || this.linked || this.closed) return;
    this.answering = true;
    this.otherId = message.from;
    try {
      if (!this.pc) this.makePc();
      await this.pc.setRemoteDescription({ type: "offer", sdp: message.sdp });
      this.remoteSet = true;
      await this.flushIce();
      const answer = await this.pc.createAnswer();
      if (this.closed) return;
      await this.pc.setLocalDescription(answer);
      await waitIce(this.pc, 1800);
      if (this.closed) return;
      this.publish({ kind: "answer", to: this.otherId, sdp: this.pc.localDescription.sdp });
    } catch (error) {
      this.fail(new RoomError("timeout", CONNECT_FAIL));
    }
  }

  async onAnswer(message) {
    if (!this.pc || this.remoteSet || this.closed) return;
    try {
      await this.pc.setRemoteDescription({ type: "answer", sdp: message.sdp });
      this.remoteSet = true;
      await this.flushIce();
    } catch (error) {
      this.fail(new RoomError("timeout", CONNECT_FAIL));
    }
  }

  async onIce(message) {
    if (!message.candidate) return;
    if (!this.pc || !this.remoteSet) {
      this.pendingIce.push(message.candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(message.candidate);
    } catch (error) { /* candidate already in the description, or the peer is gone */ }
  }

  async flushIce() {
    const queued = this.pendingIce.splice(0, this.pendingIce.length);
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (error) { /* ignore duplicates */ }
    }
  }

  makePc() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pendingIce = [];
    this.remoteSet = false;
    this.pc.onicecandidate = (event) => {
      if (!event.candidate || !this.otherId || this.closed) return;
      this.publish({ kind: "ice", to: this.otherId, candidate: event.candidate.toJSON() });
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc && this.pc.connectionState === "failed" && !this.closed) {
        this.fail(new RoomError("timeout", CONNECT_FAIL));
      }
    };
    this.pc.ondatachannel = (event) => {
      if (this.role === "guest") this.bindChannel(event.channel);
    };
  }

  bindChannel(channel) {
    if (this.channel && this.channel !== channel && this.channel.readyState === "open") return;
    this.channel = channel;
    channel.onopen = () => {
      this.linked = true;
      clearInterval(this.helloTimer);
      this.resolveWaiter("link");
      this.onopen();
    };
    channel.onmessage = (event) => {
      try {
        this.onmessage(JSON.parse(event.data));
      } catch (error) { /* ignore a bad packet */ }
    };
    channel.onclose = () => {
      const wasLinked = this.linked;
      this.linked = false;
      if (wasLinked && !this.closed) this.onclose();
    };
  }

  publishBeacon() {
    this.publishRaw(JSON.stringify({ v: 1, from: this.peerId, kind: "host", t: Date.now() }), true);
  }

  publish(obj) {
    this.publishRaw(JSON.stringify({ v: 1, from: this.peerId, ...obj }), false);
  }

  publishRaw(payload, retain) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.closed) return;
    this.ws.send(encodePublish(this.topic(), payload, retain));
  }

  waitFor(kind, ms, timeoutError) {
    if (kind === "host" && this.sawHost) return Promise.resolve();
    if (kind === "link" && this.linked) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.clearWaiter(kind);
        reject(timeoutError);
      }, ms);
      const slot = {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
      if (kind === "host") this._hostWait = slot;
      else this._linkWait = slot;
    });
  }

  resolveWaiter(kind) {
    const slot = kind === "host" ? this._hostWait : this._linkWait;
    if (!slot) return;
    this.clearWaiter(kind);
    slot.resolve();
  }

  clearWaiter(kind) {
    if (kind === "host") this._hostWait = null;
    else this._linkWait = null;
  }

  rejectWaiters(error) {
    for (const kind of ["host", "link"]) {
      const slot = kind === "host" ? this._hostWait : this._linkWait;
      this.clearWaiter(kind);
      if (slot) slot.reject(error);
    }
    if (this._connReject) this._connReject(error);
  }

  fail(error) {
    if (this.closed) return;
    this.onstatus(error.message);
    this.rejectWaiters(error);
    this.close();
  }

  dropSocket() {
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(encodeDisconnect()); } catch (error) { /* socket is already done */ }
    }
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try { ws.close(); } catch (error) { /* socket is already done */ }
    }
  }
}

export async function netSelfTest() {
  const codec = mqttCodecCheck();
  if (!codec.ok) return `FAIL\n${codec.reason}`;
  if (!webAvailable()) return "FAIL\nWebRTC is not available in this browser";
  const host = new InternetRoom();
  const guest = new InternetRoom();
  const started = Date.now();
  let guestGot = null;
  let hostGot = null;
  let hostStatus = "";
  let guestStatus = "";
  guest.onmessage = (message) => { guestGot = message; };
  host.onmessage = (message) => { hostGot = message; };
  host.onstatus = (text) => { hostStatus = text; };
  guest.onstatus = (text) => { guestStatus = text; };
  try {
    const code = await host.host();
    await guest.join(code);
    if (!host.send({ state: { x: 3, z: 4, health: 180, alive: true, kills: 1, weapon: 1 }, events: [{ type: "shot", eid: "net-test" }] })) {
      return "FAIL\nhost could not send";
    }
    if (!guest.send({ state: { x: 9, z: 1, health: 200, alive: true, kills: 0, weapon: 0 }, events: [] })) {
      return "FAIL\nguest could not send";
    }
    const deadline = Date.now() + 5000;
    while ((!guestGot || !hostGot) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    if (!guestGot || guestGot.state.x !== 3 || !guestGot.events.some((event) => event.eid === "net-test")) {
      return "FAIL\nguest did not get the host state";
    }
    if (!hostGot || hostGot.state.x !== 9) return "FAIL\nhost did not get the guest state";
    return `PASS\nlinked in ${Date.now() - started}ms via ${host.broker}`;
  } catch (error) {
    return `FAIL\n${error.message || error}\nhost: ${hostStatus}\nguest: ${guestStatus}`;
  } finally {
    host.close();
    guest.close();
  }
}
