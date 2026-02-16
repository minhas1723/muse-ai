import { splitIntoChunks } from "../src/chunker.ts";
import assert from "node:assert";

console.log("Running chunker tests...");

// Test 1: Empty text
{
  const chunks = splitIntoChunks("");
  assert.deepStrictEqual(chunks, [], "Empty text should return empty array");
}

// Test 2: Text shorter than chunk size
{
  const text = "Hello world";
  const chunks = splitIntoChunks(text, 20, 5);
  assert.deepStrictEqual(chunks, ["Hello world"], "Short text should return single chunk");
}

// Test 3: Basic splitting without smart breaks
{
  const text = "abcdefghijklmnopqrstuvwxyz";
  // chunkSize = 10, overlap = 2
  const chunks = splitIntoChunks(text, 10, 2);
  assert.deepStrictEqual(chunks, [
    "abcdefghij",
    "ijklmnopqr",
    "qrstuvwxyz",
    "yz",
    "z"
  ], "Basic splitting failed");
}

// Test 4: Splitting with paragraph break
{
  const text = "Paragraph 1.\n\nParagraph 2.";
  const chunks = splitIntoChunks(text, 20, 5);
  assert.deepStrictEqual(chunks, [
    "Paragraph 1.",
    "1.\n\nParagraph 2.",
    "ph 2.",
    "h 2.",
    "2.",
    "2.",
    "."
  ], "Paragraph splitting failed");
}

// Test 5: Splitting with newline break
{
  const text = "Line 1.\nLine 2.";
  const chunks = splitIntoChunks(text, 10, 2);
  assert.deepStrictEqual(chunks, [
    "Line 1.",
    ".\nLine 2.",
    "2.",
    "."
  ], "Newline splitting failed");
}

console.log("All tests passed!");
