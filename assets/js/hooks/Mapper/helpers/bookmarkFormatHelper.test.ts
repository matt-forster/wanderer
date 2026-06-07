import { copyToClipboard } from './bookmarkFormatHelper';

describe('copyToClipboard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the Clipboard API in a secure context', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    const ok = await copyToClipboard('hello');

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(ok).toBe(true);
  });

  it('returns false in an insecure context (no Clipboard API)', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    // @ts-ignore - simulate insecure origin where the clipboard API is absent
    Object.assign(navigator, { clipboard: undefined });

    const ok = await copyToClipboard('hello');

    expect(ok).toBe(false);
  });
});
