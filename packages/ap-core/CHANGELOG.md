# @web-media/ap-core

## 0.7.5

### Patch Changes

- Updated dependencies [156055e]
- Updated dependencies [0b36c02]
- Updated dependencies [156055e]
  - @web-media/open-promise@0.3.0
  - @web-media/resource-bridge@0.2.6

## 0.7.4

### Patch Changes

- d42ea97: feat: Add life cycle related function to the protocol
- 3031e60: feat: Add additional page status check
- Updated dependencies [d42ea97]
  - @web-media/act-protocol@0.2.11

## 0.7.3

### Patch Changes

- 4ef58d0: fix: Styling of the debugging overlay

## 0.7.2

### Patch Changes

- fix: Typo

## 0.7.1

### Patch Changes

- 07dc4e0: feat: Add a life cycle debugging flag
- Updated dependencies [07dc4e0]
  - @web-media/act-protocol@0.2.10

## 0.7.0

### Minor Changes

- 1891485: feat: Add a new asyncDataSource hook

## 0.6.0

### Minor Changes

- 4b0efc9: feat: SmartSprite as initialize task

### Patch Changes

- Updated dependencies [94ada38]
- Updated dependencies [c0142d7]
  - @web-media/definitions@0.5.0
  - @web-media/act-protocol@0.2.9
  - @web-media/resource-bridge@0.2.5

## 0.5.1

### Patch Changes

- e5e87d5: fix: DataSource in useQuery should always update
- 6f80779: fix: Show after pause should not play actPoint

## 0.5.0

### Minor Changes

- dd76191: feat: SmartSprite won't update texture until texture is ready

### Patch Changes

- Updated dependencies [148013b]
  - @web-media/act-protocol@0.2.8

## 0.4.2

### Patch Changes

- 297df61: fix: Emit textureupdate only when the texture is actual ready
- Updated dependencies [9ced044]
  - @web-media/open-promise@0.2.3

## 0.4.1

### Patch Changes

- 7554f7f: fix: Recover old context after context.wrap

## 0.4.0

### Minor Changes

- e38a3a9: feat: Add useEnvVariableGetter

## 0.3.1

### Patch Changes

- db60c3b: fix: remove frameRateLevel when animation was paused
- Updated dependencies [bda3138]
  - @web-media/definitions@0.4.2

## 0.3.1-beta.0

### Patch Changes

- db60c3b: fix: remove frameRateLevel when animation was paused

## 0.3.0

### Minor Changes

- BREAKING: Change default framerate level to ~30fps for all animations

## 0.2.3

### Patch Changes

- e7b5ff1: fix: Texture update timing

## 0.2.2

### Patch Changes

- 39dbb03: fix: Update texture scale

## 0.2.1

### Patch Changes

- chore: Update key of smart resource

## 0.2.0

### Minor Changes

- BREAKING: Change preload strategy

## 0.1.1

### Patch Changes

- Updated dependencies
  - @web-media/definitions@0.4.0
  - @web-media/act-protocol@0.2.7
  - @web-media/resource-bridge@0.2.3

## 0.1.0

### Minor Changes

- f421a81: feat: Smart texture released property
- f0374bd: feat: Smart texture reference count
- bf9b809: feat: Smart texture auto release

### Patch Changes

- 731507f: fix: Various fix around smart texture release

## 0.0.6

### Patch Changes

- 76ce3ff: feat: Get mipmap back in smart textures

## 0.0.5

### Patch Changes

- feat: Disable mipmap to reduce memory usage

## 0.0.4

### Patch Changes

- chore: Better error log when texture url missing

## 0.0.3

### Patch Changes

- Updated dependencies
  - @web-media/definitions@0.3.0
  - @web-media/act-protocol@0.2.6
  - @web-media/resource-bridge@0.2.2

## 0.0.2

### Patch Changes

- fix: Incorrect import path

## 0.0.1

### Patch Changes

- fix: Don't update texture when other env change
- fix: Restore animated sprite play state when load
- chore: Disable service worker by default since it caused atlas not working correctly
- chore: Performance improvement by batch RPC requests
- Updated dependencies
  - @web-media/act-protocol@0.2.1

## 0.0.0

### Minor Changes

- Initial public version

### Patch Changes

- Updated dependencies
  - @web-media/act-protocol@0.2.0
  - @web-media/definitions@0.2.0
  - @web-media/open-promise@0.2.0
  - @web-media/resource-bridge@0.2.0
  - @web-media/smart-resource@0.2.0
