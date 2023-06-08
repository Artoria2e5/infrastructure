import { ResourceLoaderCacheLevel } from '@web-media/definitions';
import type { IResourceItemForClient } from '@web-media/definitions';

export interface ActPointFunctions {
  fetchResource(
    resourceId: string,
    cacheLevel: ResourceLoaderCacheLevel
  ): Blob | Promise<Blob>;
  getResourceList(): IResourceItemForClient[] | Promise<IResourceItemForClient[]>;
}

export interface ServiceWorkerFunctions {
  updateResourceList(resourceList: IResourceItemForClient[]): void;
  destroy(): void;
}
