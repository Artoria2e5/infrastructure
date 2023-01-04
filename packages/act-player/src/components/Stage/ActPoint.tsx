/* eslint-disable no-await-in-loop */
/* eslint-disable no-constant-condition */
import * as React from 'react';
import cn from 'classnames';
import debug from 'debug';

import useConstant from 'use-constant';
import { useStore } from '@nanostores/react';
import { useStyletron } from 'baseui';
import { useAsync, useThrottledCallback } from '@react-hookz/web';

import { ResolutionMode } from '@recative/definitions';

import { Block } from 'baseui/block';

import { Loading } from '../Loading/Loading';
import { ModuleContainer } from '../Layout/ModuleContainer';
import type { AssetExtensionComponent } from '../../types/ExtensionCore';

import { getController } from './actPointControllers';
import { Error } from '../Panic/Error';

const logError = debug('player:ap-component');
// eslint-disable-next-line no-console
logError.log = console.error.bind(console);

const FULL_SIZE_STYLES = {
  width: '100%',
  height: '100%',
} as const;

const VISIBLE_STYLES = {
  backgroundColor: 'black',
} as const;

const RESET_POSITION_STYLES = {
  position: 'relative' as const,
} as const;

const IFRAME_STYLES = {
  pointerEvents: 'auto',
  borderWidth: 0,
} as const;

const SIZE_LIMIT_MAP = new Map<number, [number, number]>();

SIZE_LIMIT_MAP.set(1, [1280, 720]);
SIZE_LIMIT_MAP.set(2, [1920, 1080]);
SIZE_LIMIT_MAP.set(3, [Infinity, Infinity]);

const computedLimitedActPointRatio = (
  tier: unknown,
  element: HTMLDivElement | null
) => {
  if (!element) {
    return 1;
  }

  const tierLimit = SIZE_LIMIT_MAP.get(tier as number);

  if (!tierLimit) {
    return 1;
  }

  const { clientWidth, clientHeight } = element;
  const clientBox = [
    clientWidth * window.devicePixelRatio,
    clientHeight * window.devicePixelRatio
  ] as const;

  return Math.min(
    1,
    Math.max(...tierLimit) / Math.max(...clientBox),
    Math.min(...tierLimit) / Math.min(...clientBox),
  )
};

export const InternalActPoint: AssetExtensionComponent = React.memo((props) => {
  const [css] = useStyletron();
  const [scale, setScale] = React.useState(1);
  const [iFrameWidth, setIFrameWidth] = React.useState(-1);
  const [iFrameHeight, setIFrameHeight] = React.useState(-1);
  const iFrameRef = React.useRef<HTMLIFrameElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const resolution = useStore(props.core.resolution);
  const width: number | undefined = resolution?.width;
  const height: number | undefined = resolution?.height;
  const envVariable = useStore(props.core.envVariableManager.envVariableAtom);

  const getEntryPointUrl = React.useCallback(async () => {
    const episodeData = props.core.getEpisodeData()!;
    const entryPoints = props.spec.entryPoints as Record<string, string>;

    return episodeData.resources.getResourceByUrlMap(entryPoints);
  }, [props.core, props.spec.entryPoints]);

  const [{
    result: entryPoint,
    error,
  }, entryPointAction] = useAsync(getEntryPointUrl);

  const injectedEntryPoint = React.useMemo(() => {
    if (!entryPoint) return null;

    const formattedEntryPoint = new URL(entryPoint, window.location.href);
    const currentPage = new URL(window.location.href);

    currentPage.searchParams.forEach((value, key) => {
      return formattedEntryPoint.searchParams.set(key, value);
    });

    return formattedEntryPoint.toString();
  }, [entryPoint]);

  React.useEffect(() => {
    entryPointAction.execute();
  }, [entryPointAction]);

  const updateActPointScale = useThrottledCallback(
    () => {
      if (!containerRef.current) return;
      if (width === undefined || height === undefined) {
        return;
      }

      const $container = containerRef.current;
      const specResolution = props.spec.resolutionMode as ResolutionMode;
      const resolutionMode = specResolution ?? ResolutionMode.FollowPlayerSetting;

      if (resolutionMode === ResolutionMode.FixedSize) {
        setIFrameWidth(props.spec.width as number);
        setIFrameHeight(props.spec.height as number);
      } else if (resolutionMode === ResolutionMode.FollowWindowSize) {
        setIFrameWidth(-1);
        setIFrameHeight(-1);
      } else {
        setIFrameWidth(width === undefined ? -1 : width);
        setIFrameHeight(height === undefined ? -1 : height);
      }

      if (
        resolutionMode === ResolutionMode.FixedSize
        || resolutionMode === ResolutionMode.FollowPlayerSetting
        || (
          resolutionMode === ResolutionMode.FollowWindowSize
          && (envVariable?.tier === 3 || !envVariable?.tier)
        )
      ) {
        const actPointRatio = iFrameWidth / iFrameHeight;

        const containerRatio = $container.clientWidth / $container.clientHeight;

        const nextScale = actPointRatio < containerRatio
          ? $container.clientHeight / iFrameHeight
          : $container.clientWidth / iFrameWidth;

        setScale(nextScale);
      } else {
        const actPointRatio = computedLimitedActPointRatio(
          envVariable.tier,
          containerRef.current,
        );

        const { clientWidth, clientHeight } = $container;

        setScale(1 / actPointRatio);
        setIFrameWidth(actPointRatio * clientWidth);
        setIFrameHeight(actPointRatio * clientHeight);
      };
    },
    [iFrameWidth, iFrameHeight, containerRef.current],
    100,
  );

  const iFrameSizeStyleDefinition = React.useMemo(() => {
    if (iFrameWidth === -1 && iFrameHeight === -1) {
      return {
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        height: '100%',
        width: '100%',
        position: 'absolute' as const,
      };
    }

    return {
      top: '50%',
      left: '50%',
      marginLeft: `-${iFrameWidth / 2}px`,
      marginTop: `-${iFrameHeight / 2}px`,
      position: 'absolute' as const,
      transform: `scale(${scale})`,
    };
  }, [iFrameHeight, iFrameWidth, scale]);

  React.useEffect(() => {
    window.addEventListener('resize', updateActPointScale);

    return () => window.removeEventListener('resize', updateActPointScale);
  }, [updateActPointScale]);

  React.useEffect(() => {
    setTimeout(updateActPointScale, 0);
  }, [width, height, props.show, updateActPointScale]);

  const fullSizeStyles = css(FULL_SIZE_STYLES);
  const visibleStyles = css(VISIBLE_STYLES);
  const resetPositionStyles = css(RESET_POSITION_STYLES);
  const iFrameStyles = css(IFRAME_STYLES);
  const iFrameSizeStyles = css(iFrameSizeStyleDefinition);

  const core = useConstant(() => {
    const controller = getController(props.id);

    const coreFunctions = props.core.registerComponent(
      props.id,
      controller.controller,
    );

    controller.setCoreFunctions(coreFunctions);

    return { controller, coreFunctions, destroyConnector: controller.destroyConnector };
  });

  const handleEmergencyMessage = React.useCallback((event: MessageEvent) => {
    core.coreFunctions.log(`Emergency message received: ${event.data}`);

    if (event.data === 'ap-sw-not-available') {
      props.core.panicCode.set('Service Worker not Available');
    }

    if (event.data === 'ap-sw-register-error') {
      props.core.panicCode.set('Unable to Initialize the Service Worker');
    }

    if (event.data === 'ap-script-load-error') {
      props.core.panicCode.set('Unable to Load the Script');
    }
  }, [core.coreFunctions, props.core.panicCode]);

  React.useEffect(() => {
    return () => {
      core.destroyConnector();
    };
  }, [core]);

  const [loaded, setLoaded] = React.useState(false);
  const initialized = React.useRef(false);

  const handleLoaded = React.useCallback(() => {
    setLoaded(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!entryPoint) return;

    const $iFrame = iFrameRef.current;
    if (!$iFrame) return;

    if (!loaded) return;
    if (!$iFrame.contentWindow) return;
    if (initialized.current) return;

    const messageChannel = new MessageChannel();
    messageChannel.port1.addEventListener('message', handleEmergencyMessage);

    $iFrame.contentWindow.postMessage('ap-emergency-channel', '*', [
      messageChannel.port2,
    ]);

    core.controller.setActPointTag($iFrame);
    initialized.current = true;

    return () => {
      core.controller.removeActPointTag();
      messageChannel.port1.removeEventListener(
        'message',
        handleEmergencyMessage,
      );
      messageChannel.port1.close();
      initialized.current = false;
      setLoaded(false);
    };
  }, [core.controller, entryPoint, handleEmergencyMessage, initialized, loaded]);

  React.useEffect(() => {
    core.coreFunctions.updateContentState('preloading');

    return () => {
      const state = props.core.coreState.get();
      if (state === 'destroyed') return;

      props.core.unregisterComponent(props.id);
    }
  }, [core.coreFunctions, props.core, props.id]);

  const LoadingComponent = props.loadingComponent ?? Loading;

  const loading = props.show ? <LoadingComponent /> : null;

  const blockStyle = props.show
    ? cn(fullSizeStyles, resetPositionStyles, visibleStyles)
    : cn(fullSizeStyles, resetPositionStyles);

  if (error) {
    logError(
      '\r\nUnable to render this asset',
      '\r\n============================',
      '\r\nUnable to get the entry point',

      { error },
      '\r\nSpec of this asset is',

      props.spec,

      '\r\nPreferred Uploaders are',
      core.coreFunctions.core.getEpisodeData()?.preferredUploaders,
    );

    return (
      <ModuleContainer>
        <Error>{error.message}</Error>
      </ModuleContainer>
    );
  }

  return (
    <ModuleContainer>
      <Block
        ref={containerRef}
        className={blockStyle}
      >
        {injectedEntryPoint ? (
          <iframe
            title="Interactive Content"
            hidden={!props.show}
            ref={iFrameRef}
            className={cn(iFrameStyles, iFrameSizeStyles)}
            width={iFrameWidth}
            height={iFrameHeight}
            onLoad={handleLoaded}
            src={injectedEntryPoint}
          />
        ) : (
          loading
        )}
      </Block>
    </ModuleContainer>
  );
});

export const ActPoint = React.memo(InternalActPoint);
