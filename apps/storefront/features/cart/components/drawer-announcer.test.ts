import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Announcer = typeof import('./drawer-announcer');

describe('announceInDrawer', () => {
  let announcer: Announcer;
  let frames: FrameRequestCallback[];

  const flushFrames = () => {
    const pending = frames;
    frames = [];
    for (const frame of pending) frame(0);
  };

  beforeEach(async () => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.resetModules();
    announcer = await import('./drawer-announcer');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes a fresh message at once', () => {
    announcer.announceInDrawer('Removed Silk dress');
    expect(announcer.getDrawerAnnouncement()).toBe('Removed Silk dress');
    expect(frames).toHaveLength(0);
  });

  it('clears a repeated message, then republishes it after the frame', () => {
    announcer.announceInDrawer('Bag updated');
    announcer.announceInDrawer('Bag updated');
    expect(announcer.getDrawerAnnouncement()).toBe('');
    flushFrames();
    expect(announcer.getDrawerAnnouncement()).toBe('Bag updated');
  });

  it('never lets a pending repeat overwrite a newer message', () => {
    announcer.announceInDrawer('Bag updated');
    announcer.announceInDrawer('Bag updated');
    announcer.announceInDrawer('Removed Silk dress');
    flushFrames();
    expect(announcer.getDrawerAnnouncement()).toBe('Removed Silk dress');
  });

  it('publishes an empty message directly', () => {
    announcer.announceInDrawer('Bag updated');
    announcer.announceInDrawer('');
    expect(announcer.getDrawerAnnouncement()).toBe('');
    expect(frames).toHaveLength(0);
  });
});
