import { describe, expect, it, vi, beforeEach } from 'vitest';

type ExecFileCallback = (error: Error | null, result: { stdout: string; stderr: string }) => void;

const execFileMock = vi.fn(
  (_file: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
    callback(null, { stdout: '', stderr: '' });
  },
);

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

const { resolveStreamUrl, StreamResolutionError } = await import('./ytdlp.js');

describe('resolveStreamUrl', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("returns yt-dlp's stdout, trimmed", async () => {
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(null, { stdout: 'https://stream.example/audio.m4a\n', stderr: '' });
    });
    await expect(resolveStreamUrl('abc123')).resolves.toBe('https://stream.example/audio.m4a');
  });

  it('throws a StreamResolutionError when yt-dlp fails', async () => {
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(new Error('yt-dlp exited with code 1'), { stdout: '', stderr: 'error' });
    });
    await expect(resolveStreamUrl('abc123')).rejects.toBeInstanceOf(StreamResolutionError);
  });

  it('throws a StreamResolutionError when yt-dlp returns an empty URL', async () => {
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(null, { stdout: '  \n', stderr: '' });
    });
    await expect(resolveStreamUrl('abc123')).rejects.toBeInstanceOf(StreamResolutionError);
  });
});
