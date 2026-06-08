import {
  copyBookmarkName,
  copyToClipboard,
  getBookmarkNameForSignature,
  handleAutoBookmark,
} from './bookmarkFormatHelper';
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
  const sig = { id: '1', eve_id: 'abc-123', group: SignatureGroup.Wormhole } as unknown as SystemSignature;
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

describe('copyBookmarkName', () => {
  const sig = { id: '1', eve_id: 'abc-123', group: SignatureGroup.Wormhole } as unknown as SystemSignature;
  const sigs: Record<string, SystemSignature[]> = {};

  afterEach(() => jest.restoreAllMocks());

  it('copies the formatted name and reports success in a secure context', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    const result = await copyBookmarkName(
      sig,
      { bookmark_name_format: 'WH-{sig_letters}' },
      sigs,
      'sys-uuid',
      '30000142',
    );

    expect(writeText).toHaveBeenCalledWith('WH-ABC');
    expect(result).toEqual({ copied: true, name: 'WH-ABC' });
  });

  it('returns the name with copied=false in an insecure context (caller shows fallback)', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    // @ts-ignore - simulate insecure origin where the clipboard API is absent
    Object.assign(navigator, { clipboard: undefined });

    const result = await copyBookmarkName(sig, {}, sigs, 'sys-uuid', '30000142');

    expect(result).toEqual({ copied: false, name: 'abc-123' });
  });
});

describe('handleAutoBookmark copyResult', () => {
  const whSig = { id: '1', eve_id: 'abc-123', group: SignatureGroup.Wormhole } as unknown as SystemSignature;
  const sigs: Record<string, SystemSignature[]> = {};

  afterEach(() => jest.restoreAllMocks());

  it('reports the auto-copied name and success in a secure context', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    const { copyResult } = await handleAutoBookmark(
      whSig,
      { bookmark_name_format: 'WH-{sig_letters}' },
      sigs,
      'sys-uuid',
      '30000142',
      {},
      null,
    );

    expect(writeText).toHaveBeenCalledWith('WH-ABC');
    expect(copyResult).toEqual({ copied: true, name: 'WH-ABC' });
  });

  it('reports copied=false on insecure HTTP so the caller can show the name', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    // @ts-ignore - simulate insecure origin where the clipboard API is absent
    Object.assign(navigator, { clipboard: undefined });

    const { copyResult } = await handleAutoBookmark(
      whSig,
      { bookmark_name_format: 'WH-{sig_letters}' },
      sigs,
      'sys-uuid',
      '30000142',
      {},
      null,
    );

    expect(copyResult).toEqual({ copied: false, name: 'WH-ABC' });
  });

  it('returns no copyResult when auto-copy does not run (no format)', async () => {
    const { copyResult } = await handleAutoBookmark(whSig, {}, sigs, 'sys-uuid', '30000142', {}, null);

    expect(copyResult).toBeUndefined();
  });
});

describe('getBookmarkNameForSignature destination templating', () => {
  const sigs: Record<string, SystemSignature[]> = {};

  const linkedSig = (systemClass: number, name: string, extra: Partial<SystemSignature> = {}) =>
    ({
      id: '1',
      eve_id: 'abc-123',
      group: SignatureGroup.Wormhole,
      type: 'K162',
      linked_system: { system_class: systemClass, solar_system_name: name },
      ...extra,
    }) as unknown as SystemSignature;

  it('populates {dest_type} from the actual linked destination class', () => {
    const sig = linkedSig(3, 'J123456');
    expect(
      getBookmarkNameForSignature(sig, { bookmark_name_format: '{dest_type}' }, sigs, 'sys-uuid', '30000142'),
    ).toBe('C3');
  });

  it('prefers the actual linked destination over a configured dest type', () => {
    const sig = linkedSig(7, 'Jita', { custom_info: JSON.stringify({ destType: 'pochven' }) });
    expect(
      getBookmarkNameForSignature(sig, { bookmark_name_format: '{dest_type}' }, sigs, 'sys-uuid', '30000142'),
    ).toBe('HS');
  });

  it('exposes the destination system name via {dest_name}', () => {
    const sig = linkedSig(3, 'J123456');
    expect(
      getBookmarkNameForSignature(sig, { bookmark_name_format: '{dest_name}' }, sigs, 'sys-uuid', '30000142'),
    ).toBe('J123456');
  });

  it('leaves {dest_name} empty when the signature is not linked', () => {
    const sig = { id: '1', eve_id: 'abc-123', group: SignatureGroup.Wormhole } as unknown as SystemSignature;
    // empty dest_name -> whole format resolves empty -> falls back to eve_id
    expect(
      getBookmarkNameForSignature(sig, { bookmark_name_format: '{dest_name}' }, sigs, 'sys-uuid', '30000142'),
    ).toBe('abc-123');
  });
});
