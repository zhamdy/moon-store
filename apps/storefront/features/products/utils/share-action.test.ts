import { describe, expect, it } from 'vitest';
import { isShareAbort, shareAction } from './share-action';

const data = { url: 'https://moon.example/en/products/a', title: 'A' };
const share = async () => {};
const writeText = async () => {};

describe('shareAction', () => {
  it('uses the native sheet when share exists and canShare is absent', () => {
    expect(shareAction({ share, clipboard: { writeText } }, data)).toBe('share');
  });

  it('uses the native sheet when canShare accepts the data', () => {
    expect(shareAction({ share, canShare: () => true }, data)).toBe('share');
  });

  it('copies when canShare refuses the data', () => {
    expect(shareAction({ share, canShare: () => false, clipboard: { writeText } }, data)).toBe(
      'copy'
    );
  });

  it('copies when there is no Web Share API', () => {
    expect(shareAction({ clipboard: { writeText } }, data)).toBe('copy');
  });

  it('does nothing without either API or a navigator', () => {
    expect(shareAction({}, data)).toBe('none');
    expect(shareAction(undefined, data)).toBe('none');
  });
});

describe('isShareAbort', () => {
  it('recognises only AbortError', () => {
    expect(isShareAbort(new DOMException('closed', 'AbortError'))).toBe(true);
    expect(isShareAbort(new DOMException('denied', 'NotAllowedError'))).toBe(false);
    expect(isShareAbort(new Error('x'))).toBe(false);
    expect(isShareAbort(null)).toBe(false);
  });
});
