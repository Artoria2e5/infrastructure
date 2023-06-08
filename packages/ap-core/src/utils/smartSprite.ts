import * as PIXI from 'pixi.js-legacy';

import { IResourceFileForClient } from '@web-media/definitions';
import { getMatchedResource, ResourceEntry } from '@web-media/smart-resource';

import { OpenPromise, OpenPromiseState } from '@web-media/open-promise';
import { IFailedResponse, useQuery } from '../hooks/fetchDataHooks';
import { DataSource, useCombinator, useSelector } from '../core/DataSource';
import {
  DefaultTagDataSource,
  useResourceMetadataByLabelFetcher,
} from '../hooks/resourceManagerHooks';
import {
  DefaultTextureReleasedDataSource,
  SmartTextureInfo,
  useSmartResourceConfig,
  useSmartTextureInfoFromResourceMetadata,
  useSmartTextureRC,
} from './smartTexture';
import type { DataSourceNode, DataSourceNodeController, Subscribable } from '../types/dataSource';
import { useEventTarget } from '../hooks/baseHooks';
import { CHECK_SMART_TEXTURE_RELEASE } from './smartTextureReleaseChecker';
import { NEW_INITIALIZE_TASK } from '../core/actPointManager';

const useSmartTextureInfo = (
  labelDataSource: Subscribable<string>,
  tagDataSource: Subscribable<string> = DefaultTagDataSource,
  textureReleasedDataSource: Subscribable<boolean> = DefaultTextureReleasedDataSource,
): DataSourceNode<SmartTextureInfo | null> => {
  const smartResourceConfigDataSource = useSmartResourceConfig();
  const {
    subscribeResultUpdate: metadataResponseDataSource,
  } = useQuery(labelDataSource, useResourceMetadataByLabelFetcher());

  const combinedDataSource = useCombinator(
    smartResourceConfigDataSource,
    metadataResponseDataSource,
    tagDataSource,
  );

  const selectedMetadataDataSource = useSelector(
    combinedDataSource, ([smartResourceConfig, metadataResponse, tag]) => {
      if (metadataResponse === null) {
        return undefined;
      }
      if (smartResourceConfig === null) {
        return null;
      }
      if (!metadataResponse?.success) {
        console.warn(
          'Failed to get metadata:',
          (metadataResponse as IFailedResponse).error,
        );
        return null;
      }
      const metadata = metadataResponse.data;
      if (metadata === null) return null;
      if (!('type' in metadata)) {
        return null;
      }

      if (metadata.type === 'file') {
        return metadata;
      }
      const files: ResourceEntry<IResourceFileForClient>[] = metadata.files.map((file) => ({
        selector: file.tags,
        item: file,
      }));

      const file = getMatchedResource(
        files,
        {
          ...smartResourceConfig,
          custom: tag || 'unknown',
        },
      );

      if (!file) {
        return null;
      }
      return file;
    },
  );

  const getSmartTextureInfoFromResourceMetadata = useSmartTextureInfoFromResourceMetadata();

  const {
    subscribeResultUpdate: textureInfoDataResponseDataSource,
  } = useQuery(selectedMetadataDataSource, async (file) => {
    if (file === undefined) {
      return null;
    }
    const smartTextureInfo = getSmartTextureInfoFromResourceMetadata(file);
    return smartTextureInfo;
  });

  const textureInfoDataSource = useSelector(
    textureInfoDataResponseDataSource, (textureInfoResponse) => {
      if (textureInfoResponse === null) {
        return null;
      }
      if (!textureInfoResponse?.success) {
        console.warn(
          'Failed to generate SmartTextureInfo:',
          (textureInfoResponse as IFailedResponse).error,
        );
        return {};
      }
      return textureInfoResponse.data;
    },
  );

  return useSelector(useCombinator(
    textureInfoDataSource, textureReleasedDataSource,
  ), ([textureInfo, hidden]) => {
    if (hidden) {
      return {};
    }
    return textureInfo;
  });
};

export interface SmartSpriteOption {
  label?: string;
  tag?: string;
  autoReleaseTexture?: boolean;
}

export class SmartSprite extends PIXI.Sprite {
  private labelDataSource: DataSource<string>;

  private tagDataSource: DataSource<string>;

  private textureReleasedDataSource: DataSource<boolean>;

  private smartTextureInfoDataSource: DataSourceNode<SmartTextureInfo | null>;

  private smartTextureInfoController: DataSourceNodeController<SmartTextureInfo | null>;

  private smartTextureRc: ReturnType<typeof useSmartTextureRC>;

  private autoReleaseTexture: boolean;

  private eventTarget: ReturnType<typeof useEventTarget>;

  private pendingTexture: PIXI.Texture | null = null;

  private firstTextureUpdated = new OpenPromise<void>

  constructor(option: SmartSpriteOption) {
    super(PIXI.Texture.EMPTY);
    this.autoReleaseTexture = option.autoReleaseTexture ?? false;
    this.smartTextureRc = useSmartTextureRC();
    this.labelDataSource = new DataSource(option.label ?? '');
    this.tagDataSource = new DataSource(option.tag ?? 'unknown');
    this.textureReleasedDataSource = new DataSource(false);
    this.smartTextureInfoDataSource = useSmartTextureInfo(
      this.labelDataSource.subscribe,
      this.tagDataSource.subscribe,
      this.textureReleasedDataSource.subscribe,
    );
    this.smartTextureInfoController = this.smartTextureInfoDataSource(this.updateTexture);
    this.updateTexture(this.smartTextureInfoController.getter());
    this.eventTarget = useEventTarget();
    this.eventTarget.fire(NEW_INITIALIZE_TASK, this.firstTextureUpdated)
    if (this.autoReleaseTexture) {
      this.eventTarget.on(CHECK_SMART_TEXTURE_RELEASE, this.checkTextureRelease);
    }
  }

  private createTextureFromSmartTextureInfo(smartTextureInfo: SmartTextureInfo) {
    const { url } = smartTextureInfo;
    if (url === undefined) {
      return PIXI.Texture.EMPTY;
    }

    const baseTexture = this.smartTextureRc.acquire(url);

    return new PIXI.Texture(
      baseTexture,
      smartTextureInfo.frame,
      smartTextureInfo.orig,
      smartTextureInfo.trim,
      smartTextureInfo.rotate,
    );
  }

  private updateTexture = (smartTextureInfo: SmartTextureInfo | null) => {
    if (smartTextureInfo === null) {
      return;
    }
    if (this.pendingTexture !== null) {
      const oldTexture = this.pendingTexture;
      const oldUrl = oldTexture.baseTexture.cacheId;
      oldTexture.destroy();
      this.smartTextureRc.release(oldUrl);
    }
    const texture = this.createTextureFromSmartTextureInfo(smartTextureInfo);
    this.pendingTexture = texture;

    // wait for the texture to load
    if (texture.baseTexture.valid) {
      this.applyPendingTexture();
    } else {
      texture.once('update', () => {
        if (texture === this.pendingTexture) {
          this.applyPendingTexture();
        }
      }, this);
    }
  };

  private applyPendingTexture() {
    if (this.pendingTexture !== null) {
      const oldTexture = super.texture;
      const oldUrl = oldTexture.baseTexture?.cacheId;
      super.texture = this.pendingTexture;
      this.pendingTexture = null;
      if (oldTexture !== null) {
        oldTexture.destroy();
        this.smartTextureRc.release(oldUrl);
      }
      this.emit('textureupdate', {});
      if (this.firstTextureUpdated.state === OpenPromiseState.Idle
        || this.firstTextureUpdated.state === OpenPromiseState.Pending) {
        this.firstTextureUpdated.resolve()
      }
    }
  }

  private checkTextureRelease = () => {
    this.textureReleasedDataSource.data = !this.worldVisible;
  };

  get label() {
    return this.labelDataSource.data;
  }

  set label(value: string) {
    this.labelDataSource.data = value;
  }

  get tag() {
    return this.labelDataSource.data;
  }

  set tag(value: string) {
    this.tagDataSource.data = value;
  }

  get textureReleased() {
    return this.textureReleasedDataSource.data;
  }

  set textureReleased(value: boolean) {
    if (this.autoReleaseTexture) {
      throw new Error('This smart sprite automatically release texture, textureReleased should not be manually set');
    }
    this.textureReleasedDataSource.data = value;
  }

  destroy(...param: Parameters<typeof PIXI.Sprite.prototype.destroy>) {
    this.textureReleasedDataSource.data = true;
    this.smartTextureInfoController.unsubscribe();
    if (this.autoReleaseTexture) {
      this.eventTarget.off(CHECK_SMART_TEXTURE_RELEASE, this.checkTextureRelease);
    }
    this.updateTexture({});
    super.destroy(...param);
  }
}
