/**
 * Post-build script — copies static files to dist/
 * Run after `vite build`
 */

import { cpSync, mkdirSync } from "fs";

// Ensure dist exists
mkdirSync("dist/icons", { recursive: true });

// Copy manifest.json
cpSync("manifest.json", "dist/manifest.json");

// Copy sidepanel.html
cpSync("sidepanel.html", "dist/sidepanel.html");

// Copy icons
cpSync("icons/icon-16.png", "dist/icons/icon-16.png");
cpSync("icons/icon-48.png", "dist/icons/icon-48.png");
cpSync("icons/icon-128.png", "dist/icons/icon-128.png");

console.log("✅ Static files copied to dist/");
