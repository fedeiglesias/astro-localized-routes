import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd, prepareJsonLd, toAbsoluteUrl } from '../../src/index.ts';

const SITE = 'https://example.com/';

describe('toAbsoluteUrl', () => {
  it.each([
    ['/about', 'https://example.com/about/'],
    ['/about/', 'https://example.com/about/'],
    ['./about', 'https://example.com/about/'],
    ['/img/logo.png', 'https://example.com/img/logo.png'],
    ['/search?q=a', 'https://example.com/search/?q=a'],
    ['/page#top', 'https://example.com/page/#top'],
    ['/', 'https://example.com/'],
    ['https://cdn.example.org/a.png', 'https://cdn.example.org/a.png'],
    ['//cdn.example.org/a.png', '//cdn.example.org/a.png'],
    ['mailto:hi@example.com', 'mailto:hi@example.com'],
    ['#business', '#business'],
    ['', ''],
  ])('%j becomes %j', (input, expected) => {
    expect(toAbsoluteUrl(input, SITE)).toBe(expected);
  });
});

describe('prepareJsonLd', () => {
  it('adds @context when missing and keeps an existing one', () => {
    expect(prepareJsonLd({ '@type': 'Thing' }, SITE)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Thing',
    });
    expect(prepareJsonLd({ '@context': 'https://schema.org/', '@type': 'Thing' }, SITE)).toEqual({
      '@context': 'https://schema.org/',
      '@type': 'Thing',
    });
  });

  it('makes URL fields absolute at any depth, including @graph members', () => {
    const out = prepareJsonLd(
      {
        '@graph': [
          {
            '@type': 'Organization',
            '@id': '/#org',
            url: '/',
            logo: { '@type': 'ImageObject', url: '/logo.png' },
            sameAs: ['https://social.example/me', '/elsewhere'],
          },
          {
            '@type': 'Article',
            image: ['/a.jpg', { url: '/b.jpg' }],
            mainEntityOfPage: { '@type': 'WebPage', '@id': '/post' },
            thumbnailUrl: '/t.jpg',
            headline: '/not-a-url-field',
          },
        ],
      },
      SITE,
    );

    expect(out).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://example.com/#org',
          url: 'https://example.com/',
          logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' },
          sameAs: ['https://social.example/me', 'https://example.com/elsewhere/'],
        },
        {
          '@type': 'Article',
          image: ['https://example.com/a.jpg', { url: 'https://example.com/b.jpg' }],
          mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://example.com/post/' },
          thumbnailUrl: 'https://example.com/t.jpg',
          headline: '/not-a-url-field',
        },
      ],
    });
  });

  it('does not mutate its input', () => {
    const input = { '@type': 'Thing', url: '/x' };
    prepareJsonLd(input, SITE);

    expect(input).toEqual({ '@type': 'Thing', url: '/x' });
  });
});

describe('breadcrumbJsonLd', () => {
  it('builds a BreadcrumbList with absolute item URLs', () => {
    const page = {
      url: 'https://example.com/en/services/',
      breadcrumbs: [
        { label: 'Home', href: '/en/', current: false },
        { label: 'Services', href: '/en/services/', current: true },
      ],
    };

    expect(breadcrumbJsonLd(page)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com/en/' },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Services',
          item: 'https://example.com/en/services/',
        },
      ],
    });
  });

  it('returns undefined for an empty trail', () => {
    expect(breadcrumbJsonLd({ url: 'https://example.com/', breadcrumbs: [] })).toBeUndefined();
  });
});
