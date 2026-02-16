// test/verify_fix.ts

// Mock chrome global before anything else uses it
const storage: Record<string, any> = {};

const mockChrome = {
  storage: {
    local: {
      get: async (keys: string | string[] | null) => {
        if (typeof keys === 'string') {
          return { [keys]: storage[keys] };
        }
        if (Array.isArray(keys)) {
          const result: any = {};
          keys.forEach(k => result[k] = storage[k]);
          return result;
        }
        if (keys === null) {
          return storage;
        }
        return {};
      },
      set: async (items: Record<string, any>) => {
        Object.assign(storage, items);
      },
      remove: async (keys: string | string[]) => {
        if (typeof keys === 'string') {
          delete storage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => delete storage[k]);
        }
      }
    }
  }
};

// Assign to global
(globalThis as any).chrome = mockChrome;

import { encrypt, decrypt } from "../src/encryption";
import { saveSession, loadSession, ChatSession } from "../src/sessions";

// Verify encryption logic
async function testEncryption() {
  console.log("Testing encryption...");
  const data = { foo: "bar", baz: 123 };
  const encrypted = await encrypt(data);

  if (!encrypted.iv || !encrypted.data) {
    throw new Error("Encrypted data missing iv or data");
  }

  const decrypted = await decrypt(encrypted);
  if (JSON.stringify(decrypted) !== JSON.stringify(data)) {
    throw new Error("Decrypted data does not match original");
  }
  console.log("Encryption/Decryption passed.");
}

// Verify sessions
async function testSessions() {
  console.log("Testing sessions...");

  const session: ChatSession = {
    id: "test-session-1",
    title: "Test Session",
    messages: [{ role: "user", parts: [{ text: "Hello" }] }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Save session
  await saveSession(session);

  // Verify it is stored as encrypted blob
  const key = `session_${session.id}`;
  const stored = storage[key];

  if (!stored) throw new Error("Session not stored in storage");
  if (stored.id === session.id) throw new Error("Session stored in plain text!");
  if (!stored.iv || !stored.data) throw new Error("Stored session is not encrypted blob");

  console.log("Session saved securely.");

  // Load session
  const loaded = await loadSession(session.id);
  if (!loaded) throw new Error("Failed to load session");
  if (loaded.id !== session.id) throw new Error("Loaded session ID mismatch");
  if (loaded.title !== session.title) throw new Error("Loaded session title mismatch");

  console.log("Session loaded successfully.");
}

// Verify backward compatibility
async function testLegacy() {
  console.log("Testing legacy sessions...");
  const legacySession: ChatSession = {
    id: "legacy-1",
    title: "Legacy Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const key = `session_${legacySession.id}`;
  // Store directly as plain text
  storage[key] = legacySession;

  const loaded = await loadSession(legacySession.id);
  if (!loaded) throw new Error("Failed to load legacy session");
  if (loaded.id !== legacySession.id) throw new Error("Legacy session ID mismatch");

  console.log("Legacy session loaded successfully.");
}

async function run() {
  try {
    await testEncryption();
    await testSessions();
    await testLegacy();
    console.log("ALL TESTS PASSED");
  } catch (e) {
    console.error("TEST FAILED:", e);
    process.exit(1);
  }
}

run();
