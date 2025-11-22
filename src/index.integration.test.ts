import { describe, it, expect } from 'vitest';
import { getPodcast } from './index';

/**
 * Integration tests using real podcast feeds
 * These tests make actual HTTP requests to verify the library works with real feeds
 */
describe('getPodcast - Integration Tests', () => {
  // Increase timeout for real network requests
  const timeout = 15000;

  it(
    'should fetch and parse TWIT.tv podcast feed (HTTPS)',
    { timeout },
    async () => {
      const result = await getPodcast('https://feeds.twit.tv/twit.xml');

      expect(result.title).toBeDefined();
      expect(result.feed).toBe('https://feeds.twit.tv/twit.xml');
      expect(result.episodes).toBeDefined();
      expect(result.episodes!.length).toBeGreaterThan(0);
    }
  );

  it(
    'should fetch and parse TWIT.tv podcast feed with HTTP redirect',
    { timeout },
    async () => {
      const result = await getPodcast('http://feeds.twit.tv/twit.xml');

      expect(result.title).toBeDefined();
      expect(result.feed).toBe('http://feeds.twit.tv/twit.xml');
      expect(result.episodes).toBeDefined();
      expect(result.episodes!.length).toBeGreaterThan(0);
    }
  );

  it(
    'should fetch and parse Freakshow.fm podcast feed',
    { timeout },
    async () => {
      const result = await getPodcast('https://freakshow.fm/feed/m4a');

      expect(result.title).toBeDefined();
      expect(result.feed).toBe('https://freakshow.fm/feed/m4a');
      expect(result.episodes).toBeDefined();
      expect(result.episodes!.length).toBeGreaterThan(0);
    }
  );

  it(
    'should handle feeds with various episode metadata',
    { timeout },
    async () => {
      const result = await getPodcast('https://feeds.twit.tv/twit.xml');

      // Check podcast metadata
      expect(result.title).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.image).toBeDefined();

      // Check episodes
      expect(result.episodes).toBeDefined();
      expect(result.episodes!.length).toBeGreaterThan(0);

      // Check first episode has basic fields
      const firstEpisode = result.episodes![0];
      expect(firstEpisode.title).toBeDefined();
      expect(firstEpisode.enclosure).toBeDefined();
      expect(firstEpisode.enclosure?.url).toBeDefined();
    }
  );

  it(
    'should sort episodes by publication date (newest first)',
    { timeout },
    async () => {
      const result = await getPodcast('https://feeds.twit.tv/twit.xml');

      expect(result.episodes).toBeDefined();
      expect(result.episodes!.length).toBeGreaterThanOrEqual(2);

      // Verify episodes are sorted newest first
      for (let i = 0; i < result.episodes!.length - 1; i++) {
        const current = result.episodes![i];
        const next = result.episodes![i + 1];

        if (current.published && next.published) {
          expect(current.published.getTime()).toBeGreaterThanOrEqual(
            next.published.getTime()
          );
        }
      }
    }
  );
});
