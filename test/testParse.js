const mocha = require('mocha');
const podson = require('../index');
const assert = require('assert');

mocha.describe('Test Parser', () => {

    const testFeed = 'http://streaming.osu.edu/podcast/Example/Podcast.xml';

    const expectedData = {
        categories: [
            'Education',
            'Education>Higher Education'
        ],
        link: 'http://www.osu.edu',
        language: 'en-us',
        owner: {
            name: 'The Ohio State University',
            email: 'MediaServices@osu.edu'
        },
        image: 'http://streaming.osu.edu/podcast/iTunesU/Images/Icons/Generic_OSU.jpg',
        updated: new Date('2012-05-18T05:00:00.000Z'),
        title: 'Example Podcast RSS XML Code',
        description: {
            long: 'Example RSS 2.0 code for a XML 1.0 podcast including iTunes proprietary tags.',
            short: 'A working sample podcast.'
        },
        episodes: [
            {
                title: 'Example Podcast Episode',
                description: 'Example MP3 podcast item including iTunes proprietary tags.',
                subtitle: 'A working sample podcast episode.',
                enclosure: {
                    filesize: 1,
                    type: 'audio/mpeg',
                    url: 'http://streaming.osu.edu/podcast/Example/Item.mp3'
                },
                guid: 'http://streaming.osu.edu/podcast/Example/Item.mp3',
                duration: 59,
                published: new Date('2012-05-18T05:00:00.000Z')
            }
        ]
    };

    mocha.it('Tests Get', (done) => {
        podson.get(testFeed, (err, data) => {

            if (err) {
                done('An error occurred');
                return;
            }

            assert.equal(JSON.stringify(data), JSON.stringify(expectedData), 'Podcast data was not as expected.');
            done();
        });
    });

});