import { useCallback, useEffect, useRef, useState } from 'react';

import { handleAutoBookmark, numberToLetters } from '@/hooks/Mapper/helpers/bookmarkFormatHelper.ts';
import { parseSignatureCustomInfo } from '@/hooks/Mapper/helpers/parseSignatureCustomInfo';
import { useMapRootState } from '@/hooks/Mapper/mapRootProvider';
import { CommandLinkSignatureToSystem, SignatureGroup, SystemSignature } from '@/hooks/Mapper/types';
import { OutCommand } from '@/hooks/Mapper/types/mapHandlers.ts';
import { LabelsManager } from '@/hooks/Mapper/utils/labelsManager.ts';
import { useToast } from '@/hooks/Mapper/ToastProvider';
import { UserSettingsRemote } from '@/hooks/Mapper/components/mapRootContent/components/MapSettings/types.ts';

export interface UseLinkSignatureProps {
  data: CommandLinkSignatureToSystem;
  targetSystemClassGroup: string | null;
}

export const useLinkSignature = ({ data, targetSystemClassGroup }: UseLinkSignatureProps) => {
  const {
    outCommand,
    data: { systemSignatures, systems, wormholesData },
  } = useMapRootState();

  const { show: showToast } = useToast();

  const ref = useRef({ outCommand });
  ref.current = { outCommand };

  const [userSettings, setUserSettings] = useState<UserSettingsRemote | null>(null);
  const [copyFallbackName, setCopyFallbackName] = useState<string | null>(null);

  useEffect(() => {
    outCommand<{ user_settings: UserSettingsRemote }>({ type: OutCommand.getUserSettings, data: null })
      .then(res => setUserSettings(res?.user_settings ?? null))
      .catch((e: unknown) => console.warn('Failed to fetch user settings', e));
  }, [outCommand]);

  // Links a signature and, when an auto-copy of the bookmark name runs, surfaces
  // feedback: a "Copied" toast on success, or the show-name dialog on insecure HTTP
  // where the clipboard is unavailable. Returns true when a fallback dialog is now
  // showing, so the caller can keep its own dialog open until it is dismissed.
  const handleLinkSignature = useCallback(
    async (signature: SystemSignature): Promise<boolean> => {
      const { outCommand } = ref.current;

      const sourceSystem = systems.find(s => s.system_static_info?.solar_system_id === data.solar_system_source);
      const systemUuid = sourceSystem?.id || data.solar_system_source.toString();

      const targetSystem = systems.find(s => s.system_static_info?.solar_system_id === data.solar_system_target);
      const targetSystemUuid = targetSystem?.id;
      const targetSolarSystemIdStr = data.solar_system_target?.toString();

      const signatureToLink = { ...signature, group: SignatureGroup.Wormhole };

      const { updatedSignature, shouldUpdate, copyResult } = await handleAutoBookmark(
        signatureToLink,
        userSettings,
        systemSignatures,
        systemUuid,
        data.solar_system_source.toString(),
        wormholesData,
        targetSystemClassGroup,
        targetSystemUuid,
        targetSolarSystemIdStr,
      );

      let fallbackShown = false;
      if (copyResult) {
        if (copyResult.copied) {
          showToast({ severity: 'success', summary: 'Copied', detail: copyResult.name, life: 2000 });
        } else {
          // Insecure context (http://wanderer.lan): clipboard API unavailable — show
          // the name in a dialog so the user can select + copy it manually.
          setCopyFallbackName(copyResult.name);
          fallbackShown = true;
        }
      }

      if (shouldUpdate) {
        await outCommand({
          type: OutCommand.updateSignatures,
          data: {
            system_id: `${data.solar_system_source}`,
            updated: [updatedSignature],
            removed: [],
            deleteTimeout: 0,
          },
        });
      }

      await outCommand({
        type: OutCommand.linkSignatureToSystem,
        data: {
          ...data,
          signature_eve_id: signature.eve_id,
        },
      });

      const systemAutoTag = userSettings?.system_auto_tag;
      const systemCustomLabelName = userSettings?.system_custom_label_name;

      if (systemAutoTag || systemCustomLabelName) {
        const info = parseSignatureCustomInfo(updatedSignature.custom_info);

        if (info.bookmark_index !== undefined) {
          const bIndex = info.bookmark_index;
          const startAtZero = userSettings?.bookmark_wormholes_start_at_zero;
          const letter = numberToLetters(bIndex, startAtZero);

          if (targetSystem) {
            if (systemAutoTag) {
              let tagValue = '';
              switch (systemAutoTag) {
                case 'index':
                  tagValue = bIndex.toString();
                  break;
                case 'chain_index':
                  tagValue = (info.bookmark_index_chained as string) || bIndex.toString();
                  break;
                case 'index_letter':
                  tagValue = letter;
                  break;
                case 'chain_index_letters':
                  tagValue = (info.bookmark_index_chained_letters as string) || letter;
                  break;
              }

              if (tagValue) {
                await outCommand({
                  type: OutCommand.updateSystemTag,
                  data: {
                    system_id: targetSystem.id,
                    value: tagValue,
                  },
                });
              }
            }

            if (systemCustomLabelName) {
              let labelValue = '';
              switch (systemCustomLabelName) {
                case 'index':
                  labelValue = bIndex.toString();
                  break;
                case 'index_letter':
                  labelValue = letter;
                  break;
                case 'chain_index':
                  labelValue = (info.bookmark_index_chained as string) || bIndex.toString();
                  break;
                case 'chain_index_letters':
                  labelValue = (info.bookmark_index_chained_letters as string) || letter;
                  break;
              }

              if (labelValue) {
                const outLabel = new LabelsManager(targetSystem.labels ?? '');
                outLabel.updateCustomLabel(labelValue);

                await outCommand({
                  type: OutCommand.updateSystemLabels,
                  data: {
                    system_id: targetSystem.id,
                    value: outLabel.toString(),
                  },
                });
              }
            }
          }
        }
      }

      return fallbackShown;
    },
    [data, userSettings, targetSystemClassGroup, systemSignatures, systems, wormholesData, showToast],
  );

  return { handleLinkSignature, copyFallbackName, clearCopyFallback: () => setCopyFallbackName(null) };
};
