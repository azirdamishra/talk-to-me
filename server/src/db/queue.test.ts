import { describe, expect, it, beforeEach } from 'vitest';

process.env.DB_PATH = ':memory:';
const { resetDbForTests } = await import('./schema.js');
const { dequeueNext, enqueue, getOrCreateUser, getPlaybackState, peekQueue, setCurrentTrack, setPlaybackOffset } =
  await import('./queue.js');

beforeEach(() => {
  resetDbForTests();
});

describe('getOrCreateUser', () => {
  it('returns the same id for the same Amazon user id', () => {
    const first = getOrCreateUser('amzn1.account.AAA');
    const second = getOrCreateUser('amzn1.account.AAA');
    expect(first).toBe(second);
  });

  it('returns different ids for different Amazon user ids', () => {
    const a = getOrCreateUser('amzn1.account.AAA');
    const b = getOrCreateUser('amzn1.account.BBB');
    expect(a).not.toBe(b);
  });
});

describe('queue', () => {
  it('enqueues in order and dequeues FIFO', () => {
    const userId = getOrCreateUser('amzn1.account.AAA');
    enqueue(userId, 'Song A', 'vid-a');
    enqueue(userId, 'Song B', 'vid-b');

    expect(peekQueue(userId).map((item) => item.song)).toEqual(['Song A', 'Song B']);
    expect(dequeueNext(userId)?.song).toBe('Song A');
    expect(peekQueue(userId).map((item) => item.song)).toEqual(['Song B']);
  });

  it('keeps separate queues per user', () => {
    const userA = getOrCreateUser('amzn1.account.AAA');
    const userB = getOrCreateUser('amzn1.account.BBB');
    enqueue(userA, 'Song A', 'vid-a');

    expect(peekQueue(userA)).toHaveLength(1);
    expect(peekQueue(userB)).toHaveLength(0);
  });
});

describe('playback state', () => {
  it('starts with no current track', () => {
    const userId = getOrCreateUser('amzn1.account.AAA');
    expect(getPlaybackState(userId)).toEqual({
      videoId: null,
      song: null,
      offsetMs: 0,
      previousVideoId: null,
      previousSong: null,
    });
  });

  it('pushes the old current track into previous when advancing', () => {
    const userId = getOrCreateUser('amzn1.account.AAA');
    setCurrentTrack(userId, 'Song A', 'vid-a');
    setCurrentTrack(userId, 'Song B', 'vid-b');

    expect(getPlaybackState(userId)).toMatchObject({
      videoId: 'vid-b',
      song: 'Song B',
      previousVideoId: 'vid-a',
      previousSong: 'Song A',
    });
  });

  it('resets the offset to 0 whenever the current track changes', () => {
    const userId = getOrCreateUser('amzn1.account.AAA');
    setCurrentTrack(userId, 'Song A', 'vid-a');
    setPlaybackOffset(userId, 45000);
    expect(getPlaybackState(userId).offsetMs).toBe(45000);

    setCurrentTrack(userId, 'Song B', 'vid-b');
    expect(getPlaybackState(userId).offsetMs).toBe(0);
  });
});
