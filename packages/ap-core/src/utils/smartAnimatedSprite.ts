import { utils } from 'pixi.js-legacy';
import * as PIXI from 'pixi.js-legacy';
import { IDetailedResourceItemForClient, IResourceFileForClient } from '@web-media/definitions';
import { getMatchedResource, ResourceEntry } from '@web-media/smart-resource';

import { IFailedResponse, ISuccessResponse, useQuery } from '../hooks/fetchDataHooks';
import { DataSource, useCombinator, useSelector } from '../core/DataSource';
import {
  Subscribable,
  DataSourceNode,
  DataSourceNodeController,
} from '../types/dataSource';
import {
  useResourceMetadataByIdFetcher,
  useResourceMetadataByLabelFetcher,
} from '../hooks/resourceManagerHooks';
import {
  ATLAS_FRAMES_KEY,
  DefaultTextureReleasedDataSource,
  SmartTextureInfo,
  useSmartResourceConfig,
  useSmartTextureInfoFromResourceMetadata,
  useSmartTextureRC,
} from './smartTexture';
import { useEventTarget } from '../hooks/baseHooks';
import { CHECK_SMART_TEXTURE_RELEASE } from './smartTextureReleaseChecker';

const useSmartTextureInfoSequence = (
  labelDataSource: Subscribable<string>,
  textureReleasedDataSource: Subscribable<boolean> = DefaultTextureReleasedDataSource,
): DataSourceNode<SmartTextureInfo[] | null> => {
  const smartResourceConfigDataSource = useSmartResourceConfig();
  const {
    subscribeResultUpdate: metadataResponseDataSource,
  } = useQuery(labelDataSource, useResourceMetadataByLabelFetcher());
  const combinedDataSource = useCombinator(
    smartResourceConfigDataSource,
    metadataResponseDataSource,
  );

  const frameIdsDataSource = useSelector(
    combinedDataSource,
    ([smartResourceConfig, metadataResponse]) => {
      if (metadataResponse === null) {
        return undefined;
      }
      if (smartResourceConfig === null) {
        return null;
      }
      if (metadataResponse && !metadataResponse.success) {
        console.warn(
          'Failed to get metadata:',
          (metadataResponse as IFailedResponse).error,
        );
        return null;
      }
      const metadata = (metadataResponse as ISuccessResponse<IDetailedResourceItemForClient>).data;
      if (metadata === null) return null;
      if (!('type' in metadata)) {
        return null;
      }

      if (metadata.type === 'file') {
        return null;
      }
      const files: ResourceEntry<IResourceFileForClient>[] = metadata.files.map((file) => ({
        selector: file.tags,
        item: file,
      }));

      const file: IResourceFileForClient = getMatchedResource(
        files,
        {
          ...smartResourceConfig,
          custom: 'frame-sequence-pointer!',
        },
      );

      if (!file) {
        return null;
      }

      if (!('extensionConfigurations' in file)) {
        return null;
      }
      const extension = file.extensionConfigurations;

      if (!(ATLAS_FRAMES_KEY in extension)) {
        return null;
      }

      return String(extension[ATLAS_FRAMES_KEY]).split(',');
    },
  );

  const resourceUrlByIdFetcher = useResourceMetadataByIdFetcher();
  const getSmartTextureInfoFromResourceMetadata = useSmartTextureInfoFromResourceMetadata();
  const {
    subscribeResultUpdate: frameInfosResponseDataSource,
  } = useQuery(frameIdsDataSource, async (frameIds) => {
    if (frameIds === undefined) {
      return null;
    }
    if (frameIds === null) {
      return [];
    }
    const frames = await Promise.all(
      frameIds.map(resourceUrlByIdFetcher)
        .map(async (file) => {
          const f = await file;
          if (f?.type === 'group') {
            return {};
          }
          return getSmartTextureInfoFromResourceMetadata(f);
        }),
    );
    return frames;
  });

  const frameTextureInfosDataSource = useSelector(
    frameInfosResponseDataSource, (frameInfosResponse) => {
      if (frameInfosResponse === null) {
        return null;
      }
      if (!frameInfosResponse?.success) {
        console.warn(
          'Failed to generate SmartTextureInfos:',
          (frameInfosResponse as IFailedResponse).error,
        );
        return [];
      }
      return frameInfosResponse.data;
    },
  );

  return useSelector(
    useCombinator(frameTextureInfosDataSource, textureReleasedDataSource),
    ([frameTextureInfos, hidden]) => {
      if (hidden) {
        return [];
      }
      return frameTextureInfos;
    },
  );
};

export interface SmartAnimatedSpriteOption {
  label?: string,
  tag?: string;
  autoReleaseTexture?: boolean;
}

export class SmartAnimatedSprite extends PIXI.AnimatedSprite {
  private labelDataSource: DataSource<string>;

  private textureReleasedDataSource: DataSource<boolean>;

  private smartTextureInfoDataSource: DataSourceNode<SmartTextureInfo[] | null>;

  private smartTextureInfoController: DataSourceNodeController<SmartTextureInfo[] | null>;

  private smartTextureRc: ReturnType<typeof useSmartTextureRC>;

  private autoReleaseTexture: boolean;

  private eventTarget: ReturnType<typeof useEventTarget>;

  constructor(option: SmartAnimatedSpriteOption) {
    super([PIXI.Texture.EMPTY]);
    this.autoReleaseTexture = option.autoReleaseTexture ?? false;
    this.smartTextureRc = useSmartTextureRC();
    this.labelDataSource = new DataSource(option.label ?? '');
    this.textureReleasedDataSource = new DataSource(false);
    this.smartTextureInfoDataSource = useSmartTextureInfoSequence(
      this.labelDataSource.subscribe, this.textureReleasedDataSource.subscribe,
    );
    this.smartTextureInfoController = this.smartTextureInfoDataSource(this.updateTextureSequence);
    this.updateTextureSequence(this.smartTextureInfoController.getter());
    this.eventTarget = useEventTarget();
    if (this.autoReleaseTexture) {
      this.eventTarget.on(CHECK_SMART_TEXTURE_RELEASE, this.checkTextureRelease);
    }
  }

  private createTexturesFromSmartTextureInfo(smartTextureInfos: SmartTextureInfo[]) {
    if (smartTextureInfos.length <= 0) {
      return [PIXI.Texture.EMPTY];
    }
    return smartTextureInfos.map((smartTextureInfo) => {
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
    });
  }

  private updateTextureSequence = (smartTextureInfo: SmartTextureInfo[] | null) => {
    if (smartTextureInfo === null) {
      return;
    }
    const { playing } = this;
    const oldTextures = super.textures;
    const textures = this.createTexturesFromSmartTextureInfo(smartTextureInfo);
    super.textures = textures;
    const oldUrls: string[] = [];
    oldTextures.forEach((oldTexture) => {
      if (oldTexture instanceof PIXI.Texture) {
        oldUrls.push(oldTexture.baseTexture.cacheId);
        oldTexture.destroy();
      } else {
        oldUrls.push(oldTexture.texture.baseTexture.cacheId);
        oldTexture.texture.destroy();
      }
    });
    oldUrls.forEach((oldUrl) => {
      this.smartTextureRc.release(oldUrl);
    });

    // Animated sprite won't update scale with saved width/height
    // after setting the textures
    // so we should manually update it here
    const onTextureUpdate = () => {
      if (this._width) {
        this.scale.x = utils.sign(this.scale.x) * (this._width / textures[0].orig.width);
      }
      if (this._height) {
        this.scale.y = utils.sign(this.scale.y) * (this._height / textures[0].orig.height);
      }
      this.emit('textureupdate', {});
    };

    if (textures[0].baseTexture.valid) {
      onTextureUpdate();
    } else {
      textures[0].once('update', onTextureUpdate, this);
    }

    // Animated sprite will stop automatically after reset the textures
    // so restore playing state here
    if (playing) {
      this.play();
    }
  };

  private checkTextureRelease = () => {
    this.textureReleasedDataSource.data = !this.worldVisible;
  };

  get label() {
    return this.labelDataSource.data;
  }

  set label(value: string) {
    this.labelDataSource.data = value;
  }

  get textureReleased() {
    return this.textureReleasedDataSource.data;
  }

  set textureReleased(value: boolean) {
    if (this.autoReleaseTexture) {
      throw new Error('This This animated sprite automatically release textures, textureReleased should not be manually set');
    }
    this.textureReleasedDataSource.data = value;
  }

  destroy(...param: Parameters<typeof PIXI.Sprite.prototype.destroy>) {
    this.textureReleasedDataSource.data = true;
    this.smartTextureInfoController.unsubscribe();
    if (this.autoReleaseTexture) {
      this.eventTarget.off(CHECK_SMART_TEXTURE_RELEASE, this.checkTextureRelease);
    }
    this.updateTextureSequence([]);
    super.destroy(...param);
  }
}
