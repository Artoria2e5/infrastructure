/* eslint-disable no-await-in-loop */
import React from 'react';
import debug from 'debug';

import type { IEpisode, IAssetForClient, UserImplementedFunctions } from '@web-media/definitions';

import { useSdkConfig } from './useSdkConfig';
import type { IRpcFunction } from '../types/IRpcFunction';

const log = debug('client:user-fn');

export const notImplemented = (x: string) => {
  log(`ERROR: ${x} is not implemented!`);
};

export const useResetAssetStatusCallback = () => {
  const config = useSdkConfig();
  return React.useCallback(() => {
    config.setClientSdkConfig({ ...config, initialAssetStatus: undefined });
  }, [config]);
};

export interface InjectedFunctions {
  navigate: (url: string) => void;
  constructHomeUrl: () => string;
  constructSeriesUrl: (seriesId: string) => string;
  constructEpisodeUrl: (episodeId: string) => string;
  requestPayment: UserImplementedFunctions['requestPayment'];
}

export const useUserImplementedFunctions = (
  episodeId: string,
  assets: IAssetForClient[] | null,
  episodes: IEpisode[] | null,
  injectedFunctions: InjectedFunctions,
  server: IRpcFunction,
): Partial<UserImplementedFunctions> | undefined => {
  const episodeMap = React.useMemo(() => {
    const result = new Map<string | number, IEpisode>();

    episodes?.forEach((episode) => {
      result.set(episode.id, episode);
      result.set(episode.order.toString(), episode);
      result.set(episode.order, episode);
    });

    return result;
  }, [episodes]);

  const finishEpisode: UserImplementedFunctions['finishEpisode'] = React.useCallback(async () => {
    if (!assets) return;

    for (let i = 0; i < assets.length; i = i + 1) {
      const asset = assets[i];
      try {
        await server.markAssetFinished(asset.id);
      } catch (e) {
        log('Unable to mark asset as finished');
      }
    }
  }, [assets, server]);

  const unlockEpisode: UserImplementedFunctions['unlockEpisode'] = React.useCallback(
    async (unlockEpisodeId?: string) => {
      if (!unlockEpisodeId) return;

      const target = episodeMap.get(unlockEpisodeId);
      const unlockedEpisodes = await server.getUnlockedEpisodes();

      if (target === undefined) {
        throw new Error(`Target ${unlockEpisodeId} not found`);
      }

      if (unlockedEpisodes.includes(target.id)) {
        log(
          `⚠ Episode ${unlockEpisodeId} has already been unlocked, wont do anything`,
        );
        return;
      }

      try {
        await server.unlockEpisode(target.id);
      } catch (e) {
        log(e);
      }
    },
    [episodeMap, server],
  );

  const unlockAsset: UserImplementedFunctions['unlockAsset'] = React.useCallback(
    async (assetId: string) => {
      if (!assets) return;

      const asset = assets.find((x) => x.id === assetId);

      if (!asset) {
        throw new Error('Asset not found!');
      }

      try {
        await server.markAssetFinished(asset.id);
      } catch (e) {
        log('ERROR:', e);
      }
    },
    [assets, server],
  );

  const requestPayment: UserImplementedFunctions['requestPayment'] = React.useCallback((request) => {
    if (!injectedFunctions.requestPayment) {
      return notImplemented('requestPayment');
    }
    return injectedFunctions.requestPayment(request);
  }, []);

  const showVideoModal: UserImplementedFunctions['showVideoModal'] = React.useCallback(() => {
    console.warn('Show video modal is not implemented');
    // sdkConfig.setClientSdkConfig({ ...sdkConfig, videoModalUrls: [] });
  }, []);

  const gotoSeries: UserImplementedFunctions['gotoSeries'] = React.useCallback(
    (seriesId) => {
      if (!injectedFunctions.constructEpisodeUrl) {
        return notImplemented('gotoSeries');
      }

      const nextUrl = injectedFunctions.constructEpisodeUrl(seriesId);
      return injectedFunctions.navigate(nextUrl);
    },
    [injectedFunctions],
  );

  const enableAppFullScreenMode: UserImplementedFunctions['enableAppFullScreenMode'] = React.useCallback(() => {
    server.enableFullScreen?.();
    window.postMessage({ type: 'app:enableAppFullScreenMode' }, '*');
  }, [server]);

  const disableAppFullScreenMode: UserImplementedFunctions['disableAppFullScreenMode'] = React.useCallback(() => {
    server.disableFullScreen?.();
    window.postMessage({ type: 'app:disableAppFullScreenMode' }, '*');
  }, [server]);

  const getSavedData: UserImplementedFunctions['getSavedData'] = React.useCallback(async (slot) => {
    log('Will read saved data:', slot);

    try {
      const { data } = await server.getArchivedData(slot);

      const parsedData = JSON.parse(data || '');

      log(`😃 Read act save successfully, slot: ${slot}`);

      return parsedData;
    } catch (e) {
      log(`😭 Read act save failed, slot: ${slot}, error: ${e}`);
      throw e;
    }
  }, [server]);

  const setSavedData: UserImplementedFunctions['setSavedData'] = React.useCallback(async (slot, data) => {
    log(`Will write saved data: ${slot}`);

    try {
      const response = await server.updateArchivedData(
        slot,
        JSON.stringify(data),
      );

      log(`😃 Write act save successfully, slot: ${slot}`);

      return response;
    } catch (e) {
      log(`😭 Write act save failed, slot: ${slot}`);
      throw e;
    }
  }, [server]);

  const goHome = React.useCallback(() => {
    if (!injectedFunctions.constructHomeUrl) {
      return notImplemented('constructHomeUrl');
    }

    const nextUrl = injectedFunctions.constructHomeUrl();
    return injectedFunctions.navigate(nextUrl);
  }, [injectedFunctions]);

  const exit = React.useCallback(() => {
    window.close();
  }, []);

  const memorizedFunctions = React.useMemo(
    () => ({
      finishEpisode,
      unlockEpisode,
      unlockAsset,
      requestPayment,
      showVideoModal,
      gotoSeries,
      enableAppFullScreenMode,
      disableAppFullScreenMode,
      getSavedData,
      setSavedData,
      goHome,
      exit,
    }),
    [
      disableAppFullScreenMode,
      enableAppFullScreenMode,
      finishEpisode,
      getSavedData,
      gotoSeries,
      requestPayment,
      setSavedData,
      showVideoModal,
      unlockAsset,
      unlockEpisode,
      goHome,
      exit,
    ],
  );

  if (!assets || !episodes) {
    return undefined;
  }

  return memorizedFunctions;
};
