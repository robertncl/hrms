import { ImageLoaderConfig } from '@angular/common';
import { imageLoader } from './app.config';

describe('imageLoader', () => {
  it('should return the src from loaderParams when present', () => {
    const config: ImageLoaderConfig = {
      src: 'original.png',
      loaderParams: { src: 'custom-src.png' },
    };

    expect(imageLoader(config)).toBe('custom-src.png');
  });

  it('should return undefined when loaderParams is absent', () => {
    const config: ImageLoaderConfig = {
      src: 'original.png',
    };

    expect(imageLoader(config)).toBeUndefined();
  });

  it('should return undefined when loaderParams is empty', () => {
    const config: ImageLoaderConfig = {
      src: 'original.png',
      loaderParams: {},
    };

    expect(imageLoader(config)).toBeUndefined();
  });

  it('should return undefined when loaderParams does not contain src', () => {
    const config: ImageLoaderConfig = {
      src: 'original.png',
      loaderParams: { width: 100 as any },
    };

    expect(imageLoader(config)).toBeUndefined();
  });
});
