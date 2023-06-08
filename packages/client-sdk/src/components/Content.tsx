import * as React from 'react';
import debug from 'debug';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';

import { ActPlayer, InterfaceExtensionComponent } from '@web-media/act-player';
import {
  SeriesCore,
  EndEventDetail,
  SegmentEndEventDetail,
  InitializedEventDetail,
  SegmentStartEventDetail,
  IUserRelatedEnvVariable,
  EpisodeCore,
} from '@web-media/core-manager';

import type { IEpisode, RawUserImplementedFunctions } from '@web-media/definitions';
import type {
  IEpisodeMetadata,
  ISeriesCoreConfig,
} from '@web-media/core-manager';

import { useInjector } from './hooks/useInjector';
import { useSeriesCore } from './hooks/useSeriesCore';
import { useCustomEventWrapper } from './hooks/useCustomEventWrapper';

import type { PlayerPropsInjectorHook } from './hooks/useInjector';
import type { NetworkRequestStatus } from '../constant/NetworkRequestStatus';

import { loadCustomizedModule } from '../utils/loadCustomizedModule';

import { useSdkConfig } from '../hooks/useSdkConfig';
import { useEpisodeDetail } from '../hooks/useEpisodeDetail';
import { useMemoryLeakFixer } from '../hooks/useMemoryLeakFixer';
import { useResetAssetStatusCallback } from '../hooks/useResetAssetStatusCallback';

import { useDataFetcher } from './hooks/useDataFetcher';
import { CONTAINER_COMPONENT } from '../constant/storageKeys';
import { useEpisodeIdNormalizer } from './hooks/useEpisodeIdNormalizer';
import { useDiagnosisInformation } from '../hooks/useDiagnosisInformation';

const error = debug('sdk:content:error');
// This is on purpose
// eslint-disable-next-line no-console
error.log = console.error.bind(console);

const VOID_ATOM = atom('void' as const);

/**
 * Interface for the props of a wrapped player component.
 * 
 * @template PlayerPropsInjectedDependencies - Type of the platform specific
 *           dependencies shared by the player and customized user skin.
 * @template EnvVariable - Type of the environment variable object which
 *           contains the runtime configurations.
 */
export interface IContentProps<
  PlayerPropsInjectedDependencies,
  EnvVariable extends Record<string, unknown>
> {
  /**
   * The ID of the episode to be played. 
   */
  episodeId: string | undefined;

  /** 
   * An object containing user implemented functions.
   */
  userImplementedFunctions?: Partial<RawUserImplementedFunctions>;
  /**
   * An array of string representing the IDs of the preferred uploaders to be
   * used to fetch resources.
   */
  preferredUploaders: string[];
  /**
   * An array of string representing the IDs of the trusted uploaders, whose
   * resources are always be treated as available.
   */
  trustedUploaders: string[];

  /**
   * An object containing the metadata related to the client.
   */
  envVariable: EnvVariable | undefined;

  /**
   * An object containing information about the user token, avatar and nickname.
   */
  userData: IUserRelatedEnvVariable | undefined;

  /**
   * A React functional component to render while the player is loading, this
   * component is shared among all the components of the component to create
   * a consistent user experience.
   */
  LoadingComponent?: React.FC;

  /**
   * A boolean value indicating whether to attempt autoplay. 
   */
  attemptAutoplay?: IEpisodeMetadata['attemptAutoplay'];

  /**
   * The default language for the content of the episode. 
   */
  defaultContentLanguage?: IEpisodeMetadata['defaultContentLanguage'];

  /**
   * The default subtitle language for the episode. 
   */
  defaultSubtitleLanguage?: IEpisodeMetadata['defaultSubtitleLanguage'];

  /** 
   * An object containing platform-specific dependencies used by the player and
   * customized user skin. 
   */
  playerPropsHookDependencies: PlayerPropsInjectedDependencies;

  /**
   * A function to call when the episode ID is updated.
   */
  onEpisodeIdUpdate: ISeriesCoreConfig['navigate'];

  /**
   * An optional callback function called when the media playback ends.
   */
  onEnd?: (x: EndEventDetail) => void;

  /**
   * An optional callback function called when an asset playback ends.
   */
  onSegmentEnd?: (x: SegmentEndEventDetail) => void;

  /**
   * An optional callback function called when an asset playback starts.
   */
  onSegmentStart?: (x: SegmentStartEventDetail) => void;

  /**
   * An optional callback function called when the episode core is initialized.
   */
  onInitialized?: (x: InitializedEventDetail) => void;
}

const FULL_WIDTH_STYLE = { width: '100%', height: '100%' };

const DefaultContainerComponent: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  // eslint-disable-next-line react/forbid-dom-props
  <div className="demoContainer" style={FULL_WIDTH_STYLE}>
    {children}
  </div>
);

const hostSearchParameters: Record<string, string> = {};

if (typeof window !== 'undefined') {
  new URLSearchParams(window.location.search).forEach((value, key) => {
    hostSearchParameters[key] = value;
  });
}

const DefaultContainerModule = {
  Container: DefaultContainerComponent,
};

/**
 * The property of the container component, which wrap the player to manage
 * series level logic.
 */
export interface IContainerComponentProps<
  EnvVariable extends Record<string, unknown>
> {
  /**
   * An instance of EpisodeCore class, which is used to manage the current
   * episode.
   * Can be null if the episode is not yet available.
   */
  episodeCore: EpisodeCore<EnvVariable> | null;

  /**
   * An instance of SeriesCore class, which is used to manage the series that
   * the current episode belongs to.
   */
  seriesCore: SeriesCore<EnvVariable>;

  /**
   * The status of the network request for the list of episodes.
   */
  episodeListRequestStatus: NetworkRequestStatus;

  /**
   * The status of the network request for the current episode's details.
   * Can be undefined if the episode details have not yet been requested.
   */
  episodeDetailRequestStatus: NetworkRequestStatus | undefined;

  /**
   * The ID of the current episode.
   * We **must** use episode id which comes from episodeCore but not from the
   * router or the episodeDetail, this is a problem of lifecycle, only id in
   * episode id changed means the episode core ready, and we can  initialize the
   * episode safely.
   */
  episodeId: string;

  /**
   * A Map of all episodes, with the episode ID as the key and an instance of
   * episode metadata as the value.
   */
  episodes: Map<string, IEpisode>;
}

export interface IContentModule<
  PlayerPropsInjectedDependencies,
  EnvVariable extends Record<string, unknown>,
> {
  Container?: React.FC<React.PropsWithChildren<IContainerComponentProps<EnvVariable>>>;
  interfaceComponents?: InterfaceExtensionComponent[];
  usePlayerProps?: PlayerPropsInjectorHook<PlayerPropsInjectedDependencies, EnvVariable>;
}

export const ContentModuleFactory = <
  PlayerPropsInjectedDependencies,
  EnvVariable extends Record<string, unknown>,
>(
  pathPattern: string,
  dataType: string,
  baseUrl = '',
) => React.lazy(async () => {
  const debugContainerComponents = localStorage.getItem(CONTAINER_COMPONENT);

  const containerModule = await (async () => {
    try {
      return (await loadCustomizedModule(
        debugContainerComponents || 'containerComponents.js',
        pathPattern,
        dataType,
        debugContainerComponents ? null : baseUrl,
      )) as IContentModule<PlayerPropsInjectedDependencies, EnvVariable>;
    } catch (e) {
      error('Failed to load customized module!', e);
      return DefaultContainerModule as IContentModule<
        PlayerPropsInjectedDependencies, EnvVariable
      >;
    }
  })();

  const {
    usePlayerProps: internalUsePlayerPropsHook,
    Container,
    interfaceComponents,
  } = containerModule;

  const ContainerComponent: React.FC<
    React.PropsWithChildren<
      IContainerComponentProps<EnvVariable>
    >
  > = Container || DefaultContainerComponent;

  type ContentProps = IContentProps<PlayerPropsInjectedDependencies, EnvVariable>;

  const Content = ({
    children,
    episodeId: rawEpisodeId,
    envVariable,
    userData,
    LoadingComponent,
    preferredUploaders,
    trustedUploaders,
    userImplementedFunctions,
    playerPropsHookDependencies,
    onEpisodeIdUpdate,
    attemptAutoplay,
    defaultContentLanguage,
    defaultSubtitleLanguage,
    onEnd: playerOnEnd,
    onSegmentEnd: playerOnSegmentEnd,
    onSegmentStart: playerOnSegmentStart,
    onInitialized: playerOnInitialized,
    ...props
  }: React.PropsWithChildren<ContentProps>) => {
    useMemoryLeakFixer();

    const config = useSdkConfig();
    const seriesCoreRef = React.useRef<SeriesCore<EnvVariable>>();
    const normalizeEpisodeId = useEpisodeIdNormalizer();

    const episodeId = React.useMemo(
      () => {
        try {
          return normalizeEpisodeId(rawEpisodeId);
        } catch (e) {
          return undefined;
        }
      },
      [normalizeEpisodeId, rawEpisodeId],
    );

    const episodeDetail = useEpisodeDetail(episodeId ?? null);

    const dataFetcher = useDataFetcher();

    const diagnosisInformation = useDiagnosisInformation();

    const injectedEnvVariable = React.useMemo(() => ({
      episodeId,
      assets: episodeDetail?.assets,
      episode: episodeDetail?.episode,
      hostSearchParameters,
      diagnosisInformation,
      ...envVariable,
    } as unknown as EnvVariable), [
      episodeId,
      episodeDetail?.assets,
      episodeDetail?.episode,
      diagnosisInformation,
      envVariable
    ]);

    const injectedUserImplementedFunctions = React.useMemo<
      Partial<RawUserImplementedFunctions>
    >(() => ({
      ...userImplementedFunctions,
      dataFetcher,
      gotoEpisode: (_, nextEpisodeId, forceReload, assetOrder, assetTime) => {
        if (!seriesCoreRef.current) {
          throw new TypeError('Series core is not initialized, this is not allowed');
        }

        const normalizedEpisodeId = normalizeEpisodeId(nextEpisodeId);

        if (normalizeEpisodeId === undefined) {
          throw new TypeError(`Unable to normalize the episode id ${nextEpisodeId}`);
        }

        seriesCoreRef.current.setEpisode(
          normalizedEpisodeId || '',
          forceReload,
          assetOrder,
          assetTime,
        );
      },
    }), [dataFetcher, normalizeEpisodeId, userImplementedFunctions]);

    const {
      hookOnEnd,
      hookOnSegmentEnd,
      hookOnSegmentStart,
      hookUserImplementedFunctions,
      hookEnvVariable,
      hookUserData,
      injectToSdk,
      injectToContainer,
      injectToPlayer,
      getEpisodeMetadata: getInjectedEpisodeMetadata,
    } = useInjector<PlayerPropsInjectedDependencies, EnvVariable>(
      episodeId ?? null,
      preferredUploaders,
      trustedUploaders,
      injectedEnvVariable,
      userData,
      episodeDetail,
      internalUsePlayerPropsHook,
      playerPropsHookDependencies,
      injectedUserImplementedFunctions,
      onEpisodeIdUpdate,
      seriesCoreRef,
    );

    const injectedEpisodeMetadata = React.useMemo(() => ({
      attemptAutoplay: injectToSdk?.attemptAutoplay ?? attemptAutoplay,
      defaultContentLanguage: injectToSdk?.defaultContentLanguage ?? defaultContentLanguage,
      defaultSubtitleLanguage: injectToSdk?.defaultSubtitleLanguage ?? defaultSubtitleLanguage,
    }), [
      attemptAutoplay,
      defaultContentLanguage,
      defaultSubtitleLanguage,
      injectToSdk?.attemptAutoplay,
      injectToSdk?.defaultContentLanguage,
      injectToSdk?.defaultSubtitleLanguage,
    ]);

    const { episodeCore, seriesCore } = useSeriesCore<EnvVariable>(
      episodeId,
      episodeDetail,
      injectToSdk?.preferredUploaders ?? preferredUploaders,
      injectToSdk?.trustedUploaders ?? trustedUploaders,
      injectedEpisodeMetadata,
      hookUserImplementedFunctions ?? injectedUserImplementedFunctions,
      hookEnvVariable ?? injectedEnvVariable,
      hookUserData ?? userData,
      getInjectedEpisodeMetadata,
      onEpisodeIdUpdate,
    );
    React.useImperativeHandle(seriesCoreRef, () => seriesCore, [seriesCore]);

    const resetInitialAsset = useResetAssetStatusCallback();

    useCustomEventWrapper(playerOnEnd, hookOnEnd, 'end', seriesCore);
    useCustomEventWrapper(playerOnSegmentEnd, hookOnSegmentEnd, 'segmentEnd', seriesCore);
    useCustomEventWrapper(playerOnSegmentStart, hookOnSegmentStart, 'segmentStart', seriesCore);
    useCustomEventWrapper(resetInitialAsset, playerOnInitialized, 'initialized', seriesCore);

    const coreState = useStore(episodeCore?.coreState ?? VOID_ATOM);
    const playerReady = episodeDetail
      && episodeCore
      && episodeDetail.assets
      && episodeId;

    const loadingElement = LoadingComponent
      ? <div id="recative-client-sdk--early-return"><LoadingComponent /></div>
      : <div />;

    return (
      <ContainerComponent
        episodeCore={episodeCore}
        seriesCore={seriesCore}
        episodeListRequestStatus={config.requestStatus.episodes}
        episodeDetailRequestStatus={
          episodeId ? config.requestStatus[episodeId] : undefined
        }
        episodeId={episodeCore?.episodeId || ''}
        episodes={config.episodesMap}
        {...props}
        {...injectToContainer}
      >
        {
          playerReady && coreState !== 'destroyed'
            ? (
              <ActPlayer<true, EnvVariable>
                core={episodeCore}
                interfaceComponents={interfaceComponents}
                loadingComponent={LoadingComponent}
                {...injectToPlayer}
              />
            )
            : loadingElement
        }
      </ContainerComponent>
    );
  };

  return {
    default: Content as React.FC<ContentProps>,
  };
});
