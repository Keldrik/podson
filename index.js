const _ = require('lodash');
const sax = require('sax');
const request = require('request');

function parse(feedXML, callback) {
  const parser = sax.parser({
    strict: true,
    lowercase: true
  });
  const result = {
    categories: []
  };
  let node = null;

  let tmpEpisode;

  parser.onopentag = nextNode => {
    node = {
      name: nextNode.name,
      attributes: nextNode.attributes,
      parent: node
    };

    if (!node.parent) {
      return;
    }

    if (node.name === 'channel') {
      node.target = result;
      node.textMap = {
        title: true,
        link: true,
        language: text => {
          let lang = text;
          if (!/\w\w-\w\w/i.test(text)) {
            if (lang === 'en') {
              lang = 'en-us';
            } else {
              lang = `${lang}-${lang}`;
            }
          }
          return { language: lang.toLowerCase() };
        },
        'itunes:subtitle': 'subtitle',
        'itunes:summary': 'summary',
        description: 'description',
        'itunes:author': 'author',
        ttl: text => {
          return { ttl: parseInt(text) };
        },
        pubDate: text => {
          return { updated: new Date(text) };
        }
      };
    } else if (node.name === 'itunes:image' && node.parent.name === 'channel') {
      result.image = node.attributes.href;
    } else if (node.name === 'itunes:owner' && node.parent.name === 'channel') {
      result.owner = node.target = {};
      node.textMap = {
        'itunes:name': 'name',
        'itunes:email': 'email'
      };
    } else if (node.name === 'itunes:category') {
      const path = [node.attributes.text];
      let tmp = node.parent;
      while (tmp && tmp.name === 'itunes:category') {
        path.unshift(tmp.attributes.text);
        tmp = tmp.parent;
      }

      result.categories.push(path.join('>'));
    } else if (node.name === 'item' && node.parent.name === 'channel') {
      tmpEpisode = {};
      node.target = tmpEpisode;
      node.textMap = {
        title: true,
        'itunes:subtitle': 'subtitle',
        guid: true,
        description: 'description',
        'itunes:summary': 'summary',
        pubDate: text => {
          return { published: new Date(text) };
        },
        'itunes:duration': text => {
          return {
            duration: text
              .split(':')
              .reverse()
              .reduce((acc, val, index) => {
                const steps = [60, 60, 24];
                let muliplier = 1;
                while (index--) {
                  muliplier *= steps[index];
                }
                return acc + parseInt(val) * muliplier;
              }, 0)
          };
        },
        'content:encoded': 'content'
      };
    } else if (tmpEpisode) {
      if (node.name === 'itunes:image') {
        tmpEpisode.image = node.attributes.href;
      } else if (node.name === 'enclosure') {
        tmpEpisode.enclosure = {
          filesize: node.attributes.length
            ? parseInt(node.attributes.length)
            : undefined,
          type: node.attributes.type,
          url: node.attributes.url
        };
      } else if (node.name === 'psc:chapter') {
        if (!tmpEpisode.chapters) {
          tmpEpisode.chapters = [];
        }

        const startTimeTmp = node.attributes.start.split('.')[0];

        const startTime = startTimeTmp
          .split(':')
          .reverse()
          .reduce((acc, val, index) => {
            const steps = [60, 60, 24];
            let muliplier = 1;
            while (index--) {
              muliplier *= steps[index];
            }
            return acc + parseInt(val) * muliplier;
          }, 0);

        tmpEpisode.chapters.push({
          start: startTime,
          title: node.attributes.title
        });
      }
    }
  };

  parser.onclosetag = name => {
    node = node.parent;

    if (tmpEpisode && name === 'item') {
      if (!result.episodes) {
        result.episodes = [];
      }
      result.episodes.push(tmpEpisode);
      tmpEpisode = null;
    }
  };

  parser.ontext = parser.oncdata = function handleText(text) {
    text = text.trim();
    if (text.length === 0) {
      return;
    }

    if (!node || !node.parent) {
      return;
    }

    if (node.parent.textMap) {
      const key = node.parent.textMap[node.name];
      if (key) {
        if (typeof key === 'function') {
          Object.assign(node.parent.target, key(text));
        } else {
          const keyName = key === true ? node.name : key;
          const prevValue = node.parent.target[keyName];
          _.set(
            node.parent.target,
            keyName,
            prevValue ? `${prevValue} ${text}` : text
          );
        }
      }
    }

    if (tmpEpisode && node.name === 'category') {
      if (!tmpEpisode.categories) {
        tmpEpisode.categories = [];
      }
      tmpEpisode.categories.push(text);
    }
  };

  parser.onend = () => {
    if (result.episodes) {
      result.episodes = result.episodes.sort((item1, item2) => {
        return item2.published.getTime() - item1.published.getTime();
      });
    }

    if (!result.updated) {
      if (result.episodes && result.episodes.length > 0) {
        result.updated = result.episodes[0].published;
      } else {
        result.updated = null;
      }
    }

    result.categories = _.uniq(result.categories.sort());

    callback(null, result);
  };

  try {
    parser.write(feedXML).close();
  } catch (error) {
    callback(error);
  }
}

function getPodcast(feedUrl) {
  return new Promise((resolve, reject) => {
    request(feedUrl, (err, res, data) => {
      if (err) {
        reject(err);
        return;
      }
      parse(data, (parseErr, parseData) => {
        if (parseErr) {
          reject(parseErr);
        }
        if (parseData) parseData.feed = feedUrl;
        resolve(parseData);
      });
    });
  });
}

module.exports = {
  getPodcast
};
