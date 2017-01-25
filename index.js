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
    var node = null;

    var tmpEpisode;

    parser.onopentag = function (nextNode) {
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
                'title': true,
                'link': true,
                'language': text => {
                    var lang = text;
                    if (!/\w\w-\w\w/i.test(text)) {
                        if (lang === 'en') {
                            lang = 'en-us';
                        } else {
                            lang = `${lang}-${lang}`;
                        }
                    }
                    return { language: lang.toLowerCase() };
                },
                'itunes:subtitle': 'description.short',
                'description': 'description.long',
                'ttl': text => { return { ttl: parseInt(text) }; },
                'pubDate': text => { return { updated: new Date(text) }; },
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
            var tmp = node.parent;
            while (tmp && tmp.name === 'itunes:category') {
                path.unshift(tmp.attributes.text);
                tmp = tmp.parent;
            }

            result.categories.push(path.join('>'));
        } else if (node.name === 'item' && node.parent.name === 'channel') {
            tmpEpisode = {
            };
            node.target = tmpEpisode;
            node.textMap = {
                'title': true,
                'guid': true,
                'itunes:summary': 'description',
                'pubDate': text => { return { published: new Date(text) }; },
                'itunes:duration': text => {
                    return {
                        duration: text
                            .split(':')
                            .reverse()
                            .reduce((acc, val, index) => {
                                const steps = [60, 60, 24];
                                var muliplier = 1;
                                while (index--) {
                                    muliplier *= steps[index];
                                }
                                return acc + parseInt(val) * muliplier;
                            }, 0)
                    };
                }
            };
        } else if (tmpEpisode) {
            if (node.name === 'itunes:image') {
                tmpEpisode.image = node.attributes.href;
            } else if (node.name === 'enclosure') {
                tmpEpisode.enclosure = {
                    filesize: node.attributes.length ? parseInt(node.attributes.length) : undefined,
                    type: node.attributes.type,
                    url: node.attributes.url
                };
            }
        }
    };

    parser.onclosetag = function (name) {
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
                    _.set(node.parent.target, keyName, prevValue ? `${prevValue} ${text}` : text);
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

    parser.onend = function () {
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

function get(feedUrl, callback) {
    request(feedUrl, (err, res, data) => {
        if (err) {
            console.error('Network error', err);
            return;
        }

        parse(data, (err, data) => {
            if (err) {
                console.error('Parsing error', err);
                return;
            }

            callback(null, data);
        });
    });
}

module.exports = {
    get
};


// Test
// get('http://feeds.feedburner.com/NodeUp', (err, data) => {
//     if (!err) {
//         console.log(data);
//     }
// });
