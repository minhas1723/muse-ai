const ALGORITHM = "AES-GCM";
const KEY_STORAGE_KEY = "encryption_key";

// Use globalThis.crypto for broader compatibility (Node tests vs browser)
const crypto = globalThis.crypto;

// Type for encrypted data structure
export type EncryptedData = {
  iv: number[];
  data: number[];
};

// Generate a new random key
async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: ALGORITHM,
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

// Get or create the encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
  // Try to get from storage
  // Note: chrome.storage.local returns an object where keys are the requested keys
  const stored = await chrome.storage.local.get(KEY_STORAGE_KEY);

  if (stored[KEY_STORAGE_KEY]) {
    return crypto.subtle.importKey(
      "jwk",
      stored[KEY_STORAGE_KEY],
      ALGORITHM,
      true,
      ["encrypt", "decrypt"]
    );
  }

  // Create new key if not found
  const key = await generateKey();
  const exported = await crypto.subtle.exportKey("jwk", key);

  // Store the key
  await chrome.storage.local.set({ [KEY_STORAGE_KEY]: exported });
  return key;
}

/**
 * Encrypts any JSON-serializable data.
 */
export async function encrypt(data: any): Promise<EncryptedData> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    encodedData
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  };
}

/**
 * Decrypts data into its original form.
 */
export async function decrypt(encrypted: EncryptedData): Promise<any> {
  const key = await getEncryptionKey();
  const iv = new Uint8Array(encrypted.iv);
  const data = new Uint8Array(encrypted.data);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    data
  );

  const decoded = new TextDecoder().decode(decrypted);
  return JSON.parse(decoded);
}
