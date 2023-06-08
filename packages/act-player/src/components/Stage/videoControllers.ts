import type { ComponentFunctions, CoreFunctions } from '@web-media/core-manager';
import { isSafari } from '../../variables/safari';

const IS_SAFARI = isSafari();

const isVideoPlaying = (video: HTMLVideoElement) => {
  // From: https://stackoverflow.com/questions/6877403/how-to-tell-if-a-video-element-is-currently-playing
  return !!(
    video.currentTime > 0 &&
    !video.paused &&
    !video.ended &&
    video.readyState > HTMLMediaElement.HAVE_CURRENT_DATA
  );
};

const isVideoWaiting = (video: HTMLVideoElement) => {
  let buffering = true;
  const { buffered, currentTime } = video;
  for (let i = 0; i < buffered.length; i += 1) {
    if (buffered.start(i) <= currentTime && currentTime < buffered.end(i)) {
      buffering = false;
    }
  }
  return video.seeking || buffering;
};

// seconds
const BUFFER_SIZE_TARGET = 5;
const BUFFER_SIZE_DELTA = 1;

const hasEnoughBuffer = (video: HTMLVideoElement) => {
  // Note: sometime the browser do not update buffered
  // when it actually has enough data (like chrome)
  // However you can always trust readyState
  if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
    return true;
  }
  const { buffered, duration, currentTime } = video;
  for (let i = 0; i < buffered.length; i += 1) {
    if (buffered.start(i) <= currentTime && currentTime < buffered.end(i)) {
      if (
        buffered.end(i) >=
        Math.min(duration - BUFFER_SIZE_DELTA, currentTime + BUFFER_SIZE_TARGET)
      ) {
        return true;
      }
    }
  }
  return false;
};

export const getController = (id: string) => {
  let $video: HTMLVideoElement | null = null;
  let coreFunctions: CoreFunctions | null = null;

  let videoReady = false;
  let videoShown = false;
  let trackPlaying = false;
  let trackSuspended = false;
  let cachedTime = 0;

  let lastSyncTime: number | null = null;
  let lastSeekProgress: number | null = null;

  const playVideo = () => {
    if (!$video) return false;
    if (!videoReady) return false;
    if (!videoShown) return false;
    if (isVideoPlaying($video)) return false;

    $video.play().catch(() => {});
  };

  const reloadVideo = () => {
    $video?.load();
    videoReady = false;
    lastSyncTime = null;
  };

  const reportProgress = () => {
    if (!coreFunctions) return;
    if (!$video) return;
    const progress = $video.currentTime * 1000;
    const time = Date.now();
    coreFunctions.reportProgress(progress);
    // For iOS 16 Safari: recover from broken video element when
    // everything looks fine but the progress do not grow and the video is black
    if (IS_SAFARI && lastSeekProgress !== null) {
      if (Math.abs(lastSeekProgress - progress) > 10) {
        coreFunctions?.log(`The video element is broken, reload video`);
        reloadVideo();
      }
    }
    lastSeekProgress = null;
    if (isVideoPlaying($video)) {
      lastSyncTime = time;
    } else {
      lastSyncTime = null;
    }
  };

  const checkVideoPlayingState = () => {
    // For iOS Safari: sometime the video is unexpected paused by browser when the window is hidden
    if (!$video || !videoReady) {
      return;
    }
    if ($video.ended) {
      return;
    }
    const isPlaying = trackPlaying && !trackSuspended;
    if (isPlaying !== !$video.paused) {
      coreFunctions?.log(
        `Unmatched playing state: should be ${isPlaying} instead of ${!$video.paused}`
      );
      if (isPlaying) {
        playVideo();
        reportProgress();
      } else {
        $video.pause();
        reportProgress();
        lastSyncTime = null;
      }
    }
  };

  const needCheckup = () => {
    if (lastSyncTime === null) {
      return true;
    }
    return Date.now() - lastSyncTime > 300;
  };

  const forceCheckup = () => {
    if (!coreFunctions) return;
    if (!$video) return;
    checkVideoPlayingState();

    const isPlaying = trackPlaying && !trackSuspended;

    if (isPlaying && needCheckup()) {
      reportProgress();
    }
  };

  const seekVideo = (time: number) => {
    // For iOS Safari: seek to video won't work before loaded metadata
    // AND when metadata loaded and data not loaded
    // it will put the video element into a buggy state
    // where seeking is always true and currentTime won't update when playing
    // and seek will update currentTime but never actually works
    if (!$video || !videoReady) {
      cachedTime = time;
      return;
    }
    if (
      $video.readyState >= $video.HAVE_METADATA &&
      time / 1000 > $video.duration
    ) {
      // video should be already end!
      coreFunctions?.finishItself();
    } else {
      $video.currentTime = time / 1000;
      lastSeekProgress = time;
    }
  };

  const onVideoReady = () => {
    if (trackPlaying && !trackSuspended) {
      playVideo();
    } else {
      $video?.pause();
      lastSyncTime = null;
    }
    if ($video !== null) {
      $video.currentTime = cachedTime / 1000;
    }
  };

  const setVideoTag = (videoTag: HTMLVideoElement) => {
    $video = videoTag;
  };

  const removeVideoTag = () => {
    $video = null;
  };

  const setVideoReady = () => {
    if (videoReady) {
      return;
    }
    videoReady = true;
    onVideoReady();
  };

  const setVideoShown = () => {
    videoShown = true;
    if (trackPlaying && !trackSuspended) {
      playVideo();
    }
  };

  const stuck = () => {
    if (!$video) return;
    if (!coreFunctions) return;
    if (!isVideoWaiting($video)) {
      // Chrome somehow gives false positive here
      // maybe it is just seeking but it seeks so fast that
      // we already complete seeking here
      return;
    }
    const stuckReasons = [];
    if ($video.seeking) {
      stuckReasons.push('seeking');
      coreFunctions.log('Stuck reason: seeking');
    }
    if ($video.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA) {
      stuckReasons.push('do not have data');
    }
    if (stuckReasons.length <= 0) {
      stuckReasons.push('unknown');
    }
    coreFunctions.log(`Stuck reason: ${stuckReasons.join(', ')}`);
    // As a workaround to force the browser to update the readyState
    if (!$video.seeking) {
      // eslint-disable-next-line no-self-assign
      $video.currentTime = $video.currentTime;
    }
    coreFunctions.reportStuck();
  };

  const unstuckCheck = () => {
    if (!$video) return false;
    if (!coreFunctions) return false;
    if (hasEnoughBuffer($video)) {
      coreFunctions.reportUnstuck();
      coreFunctions.updateContentState('ready');
      setVideoReady();
      return true;
    }
    return false;
  };

  const controller: Partial<ComponentFunctions> = {
    showContent: (contentId) => {
      if (contentId !== id) return;

      setVideoShown();
    },
    play() {
      trackPlaying = true;
      if (!trackSuspended) {
        playVideo();
      }
      reportProgress();
    },
    pause() {
      trackPlaying = false;
      if (!trackSuspended) {
        lastSyncTime = null;
        $video?.pause();
      }
      reportProgress();
    },
    resume() {
      trackSuspended = false;
      if (trackPlaying) {
        playVideo();
      }
      reportProgress();
    },
    sync(progress, time) {
      if (!$video) return false;

      checkVideoPlayingState();
      seekVideo(performance.now() - time + progress);
    },
    suspend() {
      trackSuspended = true;
      if (trackPlaying) {
        lastSyncTime = null;
        $video?.pause();
      }
      reportProgress();
    },
  };

  const setCoreFunctions = (x: CoreFunctions) => {
    coreFunctions = x;
  };

  return {
    controller,
    setVideoTag,
    seekVideo,
    reloadVideo,
    removeVideoTag,
    setVideoShown,
    stuck,
    unstuckCheck,
    setCoreFunctions,
    reportProgress,
    forceCheckup,
    checkVideoPlayingState,
  };
};
