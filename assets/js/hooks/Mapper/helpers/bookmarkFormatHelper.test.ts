import { copyToClipboard, getBookmarkNameForSignature } from './bookmarkFormatHelper';
import { SignatureGroup, SystemSignature } from '@/hooks/Mapper/types';

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

describe('getBookmarkNameForSignature', () => {
  const sig = { id: '1', eve_id: 'abc-123', group: SignatureGroup.Wormhole } as SystemSignature;
  const sigs: Record<string, SystemSignature[]> = {};

  it('returns the raw eve_id when no format is set', () => {
    expect(getBookmarkNameForSignature(sig, {}, sigs, 'sys-uuid', '30000142')).toBe('abc-123');
  });

  it('applies the bookmark name format', () => {
    const settings = { bookmark_name_format: 'WH-{sig_letters}' };
    expect(getBookmarkNameForSignature(sig, settings, sigs, 'sys-uuid', '30000142')).toBe('WH-ABC');
  });

  it('falls back to eve_id when the format resolves to empty', () => {
    const settings = { bookmark_name_format: '{dest_type}' };
    expect(getBookmarkNameForSignature(sig, settings, sigs, 'sys-uuid', '30000142')).toBe('abc-123');
  });
});
