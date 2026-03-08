/**
 * @packageDocumentation
 * Podson - A podcast RSS/XML feed parser that converts podcast feeds into clean JSON objects.
 *
 * This module provides functionality to fetch and parse podcast RSS feeds, extracting metadata,
 * episodes, and related information into well-structured TypeScript interfaces.
 *
 * @module podson
 */

import sax, { Tag } from 'sax';
import got, { HTTPError, TimeoutError } from 'got';

import { Podcast, Episode, Owner } from './types';

interface ParsingNode {
  name: string;
  attributes: Record<string, string>;
  parent: ParsingNode | null;
  target?: Partial<Podcast> | Partial<Episode> | Partial<Owner>;
  textMap?: Record<
    string,
    | boolean
    | string
    | ((text: string) => Record<string, string | number | Date>)
  >;
}

const languageRegionMap: Record<string, string> = {
  en: 'en-us',
  ja: 'ja-jp',
  zh: 'zh-cn',
  ko: 'ko-kr',
  ar: 'ar-sa',
  he: 'he-il',
  hi: 'hi-in',
  ur: 'ur-pk',
  fa: 'fa-ir',
  vi: 'vi-vn',
  th: 'th-th',
  sv: 'sv-se',
  da: 'da-dk',
  nb: 'nb-no',
  nn: 'nn-no',
  uk: 'uk-ua',
  cs: 'cs-cz',
  el: 'el-gr',
  sl: 'sl-si',
  et: 'et-ee',
  ka: 'ka-ge',
};

function parseLanguage(text: string): { language: string } {
  const lang = text.trim().toLowerCase();
  if (/^[a-z]{2,3}[_-][a-z]{2,4}$/i.test(lang)) {
    return { language: lang.replace('_', '-') };
  }
  if (languageRegionMap[lang]) {
    return { language: languageRegionMap[lang] };
  }
  if (/^[a-z]{2}$/.test(lang)) {
    return { language: `${lang}-${lang}` };
  }
  return { language: lang };
}

function parseTime(text: string): number {
  if (!text) return 0;

  const parts = text.split(':').slice(0, 3);
  const multipliers = [1, 60, 3600];

  return parts.reverse().reduce((acc, val, index) => {
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 0) return acc;
    return acc + parsed * multipliers[index];
  }, 0);
}

function finalizePodcast(result: Podcast): Podcast {
  if (result.episodes) {
    result.episodes = result.episodes.sort((a, b) => {
      const av = a.published ? a.published.getTime() : 0;
      const bv = b.published ? b.published.getTime() : 0;
      return bv - av;
    });
  }

  if (!result.updated) {
    if (result.episodes && result.episodes.length > 0) {
      result.updated = result.episodes[0].published ?? null;
    } else {
      result.updated = null;
    }
  }

  result.categories = [...new Set(result.categories)].sort();
  return result;
}

function parse(feedXML: string): Promise<Podcast> {
  return new Promise((resolve, reject) => {
    const parser = sax.parser(false, { lowercase: true });
    const result: Podcast = { categories: [] };
    let node: ParsingNode | null = null;
    let tmpEpisode: Episode | undefined;

    function handleOpenTag(nextNode: Tag) {
      node = {
        name: nextNode.name,
        attributes: nextNode.attributes as Record<string, string>,
        parent: node,
      };

      if (!node.parent) {
        return;
      }

      if (node.name === 'channel') {
        node.target = result as unknown as Record<string, unknown>;
        node.textMap = {
          title: true,
          link: true,
          language: (text: string) => parseLanguage(text),
          'itunes:subtitle': 'subtitle',
          'itunes:summary': 'summary',
          description: 'description',
          'itunes:author': 'author',
          copyright: true,
          ttl: (text: string) => ({ ttl: parseInt(text, 10) }),
          pubdate: (text: string) => ({ updated: new Date(text) }),
        };
      } else if (
        node.name === 'itunes:image' &&
        node.parent.name === 'channel'
      ) {
        if (node.attributes?.href) {
          result.image = node.attributes.href;
        }
      } else if (
        node.name === 'itunes:owner' &&
        node.parent.name === 'channel'
      ) {
        const owner: Owner = {};
        result.owner = owner;
        node.target = owner as unknown as Record<string, unknown>;
        node.textMap = {
          'itunes:name': 'name',
          'itunes:email': 'email',
        };
      } else if (node.name === 'itunes:category') {
        if (node.attributes?.text) {
          const path = [node.attributes.text];
          let tmp: ParsingNode | null = node.parent;
          while (tmp && tmp.name === 'itunes:category') {
            if (tmp.attributes?.text) {
              path.unshift(tmp.attributes.text);
            }
            tmp = tmp.parent;
          }
          result.categories.push(path.join('>'));
        }
      } else if (node.name === 'item' && node.parent.name === 'channel') {
        tmpEpisode = {} as Episode;
        node.target = tmpEpisode as unknown as Record<string, unknown>;
        node.textMap = {
          title: true,
          'itunes:subtitle': 'subtitle',
          guid: true,
          description: 'description',
          'itunes:summary': 'summary',
          pubdate: (text: string) => ({ published: new Date(text) }),
          'itunes:duration': (text: string) => ({ duration: parseTime(text) }),
          'content:encoded': 'content',
        };
      } else if (tmpEpisode) {
        if (node.name === 'itunes:image') {
          if (node.attributes?.href) {
            tmpEpisode.image = node.attributes.href;
          }
        } else if (node.name === 'enclosure') {
          tmpEpisode.enclosure = {
            filesize: node.attributes?.length
              ? parseInt(node.attributes.length, 10)
              : undefined,
            type: node.attributes?.type,
            url: node.attributes?.url,
          };
        } else if (node.name === 'psc:chapter') {
          if (node.attributes?.start && node.attributes?.title) {
            if (!tmpEpisode.chapters) {
              tmpEpisode.chapters = [];
            }
            const startTimeTmp = node.attributes.start.split('.')[0];
            const startTime = parseTime(startTimeTmp);
            tmpEpisode.chapters.push({
              start: startTime,
              title: node.attributes.title,
            });
          }
        }
      }
    }

    function handleCloseTag(name: string) {
      if (node && node.parent?.textMap && node.parent?.target) {
        const key = node.parent.textMap[node.name];
        if (key && typeof key !== 'function') {
          const keyName = key === true ? node.name : key;
          const value = (node.parent.target as Record<string, unknown>)[
            keyName
          ];
          if (typeof value === 'string') {
            (node.parent.target as Record<string, unknown>)[keyName] =
              value.trim();
          }
        }
      }
      node = node ? node.parent : null;
      if (tmpEpisode && name === 'item') {
        if (!result.episodes) {
          result.episodes = [];
        }
        result.episodes.push(tmpEpisode);
        tmpEpisode = undefined;
      }
    }

    function handleText(text: string) {
      if (!text || !node || !node.parent) {
        return;
      }

      if (node.parent.textMap && node.parent.target) {
        const key = node.parent.textMap[node.name];
        if (key) {
          if (typeof key === 'function') {
            Object.assign(node.parent.target, key(text.trim()));
          } else {
            const keyName = key === true ? node.name : key;
            const prevValue = (node.parent.target as Record<string, unknown>)[
              keyName
            ];
            (node.parent.target as Record<string, unknown>)[keyName] = prevValue
              ? `${prevValue}${text}`
              : text;
          }
        }
      }

      if (tmpEpisode && node.name === 'category') {
        if (!tmpEpisode.categories) {
          tmpEpisode.categories = [];
        }
        tmpEpisode.categories.push(text.trim());
      }
    }

    parser.onopentag = handleOpenTag;
    parser.onclosetag = handleCloseTag;
    parser.ontext = parser.oncdata = handleText;
    parser.onerror = (err: Error) => {
      reject(new Error(`Failed to parse podcast feed: ${err.message}`));
    };
    parser.onend = () => {
      resolve(finalizePodcast(result));
    };

    try {
      parser.write(feedXML).close();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown parsing error';
      reject(new Error(`Failed to parse podcast feed: ${errorMessage}`));
    }
  });
}

/**
 * Fetches and parses a podcast RSS/XML feed into a structured JSON object.
 *
 * This is the main function of the podson library. It downloads the podcast feed from the
 * provided URL, parses the XML, and returns a clean, structured Podcast object with all
 * episodes and metadata.
 *
 * @param feedUrl - The URL of the podcast RSS/XML feed to fetch and parse
 * @returns A Promise that resolves to a Podcast object containing all feed data
 *
 * @throws {Error} When the feed cannot be fetched (network error, timeout, HTTP error)
 * @throws {Error} When the feed XML cannot be parsed (malformed XML)
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { getPodcast } from 'podson';
 *
 * const podcast = await getPodcast('https://example.com/podcast/feed.xml');
 * console.log(podcast.title);
 * console.log(podcast.episodes?.length);
 * ```
 *
 * @example
 * With error handling:
 * ```typescript
 * import { getPodcast } from 'podson';
 *
 * try {
 *   const podcast = await getPodcast('https://example.com/podcast/feed.xml');
 *
 *   // Access podcast metadata
 *   console.log(`Podcast: ${podcast.title}`);
 *   console.log(`Author: ${podcast.author}`);
 *   console.log(`Episodes: ${podcast.episodes?.length}`);
 *
 *   // Access latest episode
 *   if (podcast.episodes && podcast.episodes.length > 0) {
 *     const latestEpisode = podcast.episodes[0]; // Episodes are sorted newest first
 *     console.log(`Latest: ${latestEpisode.title}`);
 *     console.log(`Audio: ${latestEpisode.enclosure?.url}`);
 *   }
 * } catch (error) {
 *   console.error('Failed to fetch podcast:', error.message);
 * }
 * ```
 *
 * @remarks
 * - Follows HTTP redirects automatically (up to 10 redirects)
 * - Timeout is set to 10 seconds
 * - Episodes in the returned object are automatically sorted by publication date (newest first)
 * - All fields in the Podcast object are optional except 'categories' (which defaults to an empty array)
 */
export async function getPodcast(feedUrl: string): Promise<Podcast> {
  try {
    new URL(feedUrl);
  } catch {
    throw new Error(`Invalid podcast feed URL: ${feedUrl}`);
  }

  try {
    const data = await got(feedUrl, {
      followRedirect: true,
      maxRedirects: 10,
      timeout: { request: 10000 },
    }).text();
    const result = await parse(data);
    result.feed = feedUrl;
    return result;
  } catch (error: unknown) {
    if (error instanceof TimeoutError) {
      throw new Error(`Timeout fetching podcast feed: ${feedUrl}`, {
        cause: error,
      });
    }
    if (error instanceof HTTPError) {
      throw new Error(
        `Failed to fetch podcast (HTTP ${error.response.statusCode}): ${feedUrl}`,
        { cause: error }
      );
    }
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to fetch podcast: ${errorMessage}`, {
      cause: error,
    });
  }
}

// Re-export types for developer convenience
export type { Podcast, Episode, Owner, Enclosure, Chapter } from './types';
