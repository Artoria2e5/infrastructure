/* eslint-disable @typescript-eslint/no-explicit-any */
import { createEventName, Event } from '@web-media/event-target';

import type { DynamicView } from './DynamicView';

export interface ICollectionDocumentPreInsertEventDetail<T> {
  documents: T[];
}

export const CollectionDocumentPreInsertEventName =
  createEventName<ICollectionDocumentPreInsertEventDetail<any>>('pre-insert');

export class CollectionDocumentPreInsertEvent<T> extends Event<
  ICollectionDocumentPreInsertEventDetail<T>
> {
  constructor(documents: T[]) {
    super(CollectionDocumentPreInsertEventName, { documents });
  }
}

export interface ICollectionDocumentInsertEventDetail<T> {
  documents: T[];
}

export const CollectionDocumentInsertEventName =
  createEventName<ICollectionDocumentInsertEventDetail<any>>('insert');

export class CollectionDocumentInsertEvent<T> extends Event<
  ICollectionDocumentInsertEventDetail<T>
> {
  constructor(documents: T[]) {
    super(CollectionDocumentInsertEventName, { documents });
  }
}

export interface ICollectionDocumentPreUpdateEventDetail<T> {
  document: T;
}

export const CollectionDocumentPreUpdateEventName =
  createEventName<ICollectionDocumentPreUpdateEventDetail<any>>('pre-update');

export class CollectionDocumentPreUpdateEvent<T> extends Event<
  ICollectionDocumentPreUpdateEventDetail<T>
> {
  constructor(document: T) {
    super(CollectionDocumentPreUpdateEventName, { document });
  }
}

export interface ICollectionDocumentUpdateEventDetail<T> {
  newDocument: T;
  oldDocument: T;
}

export const CollectionDocumentUpdateEventName =
  createEventName<ICollectionDocumentUpdateEventDetail<any>>('update');

export class CollectionDocumentUpdateEvent<T> extends Event<
  ICollectionDocumentUpdateEventDetail<T>
> {
  constructor(newDocument: T, oldDocument: T) {
    super(CollectionDocumentUpdateEventName, { newDocument, oldDocument });
  }
}

export interface ICollectionDocumentDeleteEventDetail<T> {
  document: T;
}

export const CollectionDocumentDeleteEventName =
  createEventName<ICollectionDocumentDeleteEventDetail<any>>('delete');

export class CollectionDocumentDeleteEvent<T> extends Event<
  ICollectionDocumentDeleteEventDetail<T>
> {
  constructor(document: T) {
    super(CollectionDocumentDeleteEventName, { document });
  }
}

export interface IErrorEventDetail {
  error: unknown;
}

export interface IDynamicViewRebuildEventDetail<T> {
  dynamicView: DynamicView<T>;
}

export const DynamicViewRebuildEventName =
  createEventName<IDynamicViewRebuildEventDetail<any>>('rebuild');

export class DynamicViewRebuildEvent<T> extends Event<
  IDynamicViewRebuildEventDetail<T>
> {
  constructor(dynamicView: DynamicView<T>) {
    super(DynamicViewRebuildEventName, { dynamicView });
  }
}

export const DynamicViewFilterEventName = createEventName<void>('filter');

export class DynamicViewFilterEvent extends Event<void> {
  constructor() {
    super(DynamicViewFilterEventName, undefined);
  }
}

export const DynamicViewSortEventName = createEventName<void>('sort');

export class DynamicViewSortEvent extends Event<void> {
  constructor() {
    super(DynamicViewSortEventName, undefined);
  }
}

export const ErrorEventName = createEventName<IErrorEventDetail>('error');

export class ErrorEvent extends Event<IErrorEventDetail> {
  constructor(error: unknown) {
    super(ErrorEventName, { error });
  }
}

export const WarnEventName = createEventName<IErrorEventDetail>('warning');

export class WarnEvent extends Event<IErrorEventDetail> {
  constructor(error: unknown) {
    super(WarnEventName, { error });
  }
}

export interface IDatabaseDocumentLoadEventDetail {
  fileName: string;
  isEmpty: boolean;
}

export const DatabaseDocumentLoadEventName =
  createEventName<IDatabaseDocumentLoadEventDetail>('load');

export class DatabaseDocumentLoadEvent extends Event<IDatabaseDocumentLoadEventDetail> {
  constructor(fileName: string, isEmpty: boolean) {
    super(DatabaseDocumentLoadEventName, { fileName, isEmpty });
  }
}

export const DatabaseCloseEventName = createEventName<void>('close');

export class DatabaseCloseEvent extends Event<void> {
  constructor() {
    super(DatabaseCloseEventName);
  }
}
