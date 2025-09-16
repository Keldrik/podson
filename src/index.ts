import _ from 'lodash';
import sax, { Tag } from 'sax';
import got from 'got';

import {
  Podcast,
  Episode,
  Enclosure,
  Chapter,
  Owner,
} from './types';

interface ParsingNode {
  name: string;
  attributes: Record<string, string>;
  parent: ParsingNode | null;
  target?: Record<string, any>;
  textMap?: Record<
    string,
    boolean | string | ((text: string) => Record<string, any>)
  >;
}

function parseLanguage(text: string): { language: string } {
  let lang = text;
  if (!/\w\w-\w\w/i.test(text)) {
    lang = lang === 'en' ? 'en-us' : `${lang}-${lang}`;
  }
  return { language: lang.toLowerCase() };
}

function parseTime(text: string): number {
  return text
    .split(':')
    .reverse()
    .reduce((acc, val, index) => {
      const steps = [60, 60, 24];
      let muliplier = 1;
      let i = index;
      while (i--) {
        muliplier *= steps[i];
      }
      return acc + parseInt(val, 10) * muliplier;
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

  result.categories = _.uniq(result.categories.sort());
  return result;
}

function parse(feedXML: string): Promise<Podcast> {
  return new Promise((resolve, reject) => {
    const parser = sax.parser(true, { lowercase: true });
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
        node.target = result as Record<string, any>;
        node.textMap = {
          title: true,
          link: true,
          language: (text: string) => parseLanguage(text),
          'itunes:subtitle': 'subtitle',
          'itunes:summary': 'summary',
          description: 'description',
          'itunes:author': 'author',
          ttl: (text: string) => ({ ttl: parseInt(text, 10) }),
          pubDate: (text: string) => ({ updated: new Date(text) }),
        };
      } else if (node.name === 'itunes:image' && node.parent.name === 'channel') {
        result.image = (node.attributes as Record<string, string>).href;
      } else if (node.name === 'itunes:owner' && node.parent.name === 'channel') {
        const owner: Owner = {};
        result.owner = owner;
        node.target = owner as Record<string, any>;
        node.textMap = {
          'itunes:name': 'name',
          'itunes:email': 'email',
        };
      } else if (node.name === 'itunes:category') {
        const path = [node.attributes.text];
        let tmp: ParsingNode | null = node.parent;
        while (tmp && tmp.name === 'itunes:category') {
          path.unshift(tmp.attributes.text);
          tmp = tmp.parent;
        }
        result.categories.push(path.join('>'));
      } else if (node.name === 'item' && node.parent.name === 'channel') {
        tmpEpisode = {} as Episode;
        node.target = tmpEpisode as Record<string, any>;
        node.textMap = {
          title: true,
          'itunes:subtitle': 'subtitle',
          guid: true,
          description: 'description',
          'itunes:summary': 'summary',
          pubDate: (text: string) => ({ published: new Date(text) }),
          'itunes:duration': (text: string) => ({ duration: parseTime(text) }),
          'content:encoded': 'content',
        };
      } else if (tmpEpisode) {
        if (node.name === 'itunes:image') {
          tmpEpisode.image = (node.attributes as Record<string, string>).href;
        } else if (node.name === 'enclosure') {
          tmpEpisode.enclosure = {
            filesize: node.attributes.length
              ? parseInt(node.attributes.length, 10)
              : undefined,
            type: node.attributes.type,
            url: node.attributes.url,
          };
        } else if (node.name === 'psc:chapter') {
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

    function handleCloseTag(name: string) {
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
      const trimmed = text.trim();
      if (trimmed.length === 0 || !node || !node.parent) {
        return;
      }

      if (node.parent.textMap) {
        const key = node.parent.textMap[node.name];
        if (key) {
          if (typeof key === 'function') {
            Object.assign(node.parent.target!, key(trimmed));
          } else {
            const keyName = key === true ? node.name : key;
            const prevValue = (node.parent.target as Record<string, any>)[keyName];
            (node.parent.target as Record<string, any>)[keyName] = prevValue
              ? `${prevValue} ${trimmed}`
              : trimmed;
          }
        }
      }

      if (tmpEpisode && node.name === 'category') {
        if (!tmpEpisode.categories) {
          tmpEpisode.categories = [];
        }
        tmpEpisode.categories.push(trimmed);
      }
    }

    parser.onopentag = handleOpenTag;
    parser.onclosetag = handleCloseTag;
    parser.ontext = parser.oncdata = handleText;
    parser.onend = () => {
      resolve(finalizePodcast(result));
    };

    try {
      parser.write(feedXML).close();
    } catch (error) {
      reject(error);
    }
  });
}

export async function getPodcast(feedUrl: string): Promise<Podcast> {
  const data = await got.get(feedUrl, {
    http2: true,
    resolveBodyOnly: true,
    timeout: 10000,
  });
  const result = await parse(data);
  result.feed = feedUrl;
  return result;
}

export default { getPodcast };

