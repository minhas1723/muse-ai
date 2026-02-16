// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import React, { Profiler } from 'react';
import { App } from './sidepanel';

// Mock chrome
const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockImplementation((keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }
  },
};
global.chrome = chromeMock as any;

describe('App Performance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  it('renders excessively on rapid stream chunks', async () => {
    // Setup mocks
    chromeMock.runtime.sendMessage.mockImplementation((msg) => {
      if (msg.type === 'getAuthStatus') {
        return Promise.resolve({ loggedIn: true, email: 'test@example.com' });
      }
      if (msg.type === 'listSessions') {
        return Promise.resolve({ sessions: [] });
      }
      if (msg.type === 'createSession') {
         return Promise.resolve({ session: { id: '123', messages: [] } });
      }
      if (msg.type === 'saveSession') {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    // Mock port for streaming
    const portListeners: ((msg: any) => void)[] = [];
    const port = {
      onMessage: {
        addListener: (fn: any) => portListeners.push(fn),
        removeListener: vi.fn(),
      },
      postMessage: vi.fn(),
      disconnect: vi.fn(),
    };
    chromeMock.runtime.connect.mockReturnValue(port);

    // Render with Profiler
    let renderCount = 0;
    const onRender = (id: string, phase: string) => {
      if (phase === 'update') renderCount++;
    };

    render(
      <Profiler id="App" onRender={onRender}>
        <App />
      </Profiler>
    );

    // Wait for initial load
    await screen.findByPlaceholderText('Ask anything...');

    const input = screen.getByPlaceholderText('Ask anything...');
    const submitBtn = screen.getByRole('button', { name: '' }) || screen.container.querySelector('button[type="submit"]');

    // Type message
    fireEvent.change(input, { target: { value: 'Hello AI' } });

    // Send message
    fireEvent.click(submitBtn as Element);

    // Wait for stream to start (port.connect called)
    await waitFor(() => {
        expect(chromeMock.runtime.connect).toHaveBeenCalled();
    });

    // Reset render count (ignore setup renders)
    renderCount = 0;

    // Simulate 100 chunks
    // We expect the optimization to batch these into fewer renders even if they arrive with delays
    await act(async () => {
        for (let i = 0; i < 100; i++) {
            portListeners.forEach(fn => fn({ type: 'chunk', text: 'a' }));
            await new Promise(r => setTimeout(r, 1));
        }
        await new Promise(r => setTimeout(r, 50));
        portListeners.forEach(fn => fn({ type: 'done' }));
    });

    console.log('Render count:', renderCount);
    // Expect low render count due to throttling (e.g. < 50 for 100 chunks)
    expect(renderCount).toBeLessThan(50);
    // Ensure we rendered at least once
    expect(renderCount).toBeGreaterThan(0);

    // Verify content is correct
    // We expect 100 'a's
    const expectedContent = 'a'.repeat(100);
    // Use findByText with exact: false or a function because markdown might wrap it
    await screen.findByText((content, element) => {
        return element?.tagName.toLowerCase() === 'p' && content.includes(expectedContent);
    });
  });
});
