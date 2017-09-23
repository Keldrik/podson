# podson

Parses a remote podcast feed and returns javascript object.

## Output

```json

{
  "title":       "Podcast Title",
  "description": {
    "short":       "Podcast Subtitle",
    "description": "Podcast Description"
  },
  "link":       "Podcast Link",
  "image":      "Podcast Image",
  "language":   "Language",
  "copyright":  "Copyright",
  "updated":    "PubDate",
  "categories": [
    "Category",
    "Category Subcategory",
  ],
  "owner": {
    "name":  "Author Name",
    "email": "Author Email"
  },
  "episodes": [
    {
      "guid":        "Unique Id",
      "title":       "Episode Title",
      "subtitle":    "Episode Subtitle",
      "description": "Episode Description",
      "content":     "<Content Encoded>",
      "image":       "Episode Image",
      "published":   "Date",
      "duration":    456,
      "categories":  [
        "Category"
      ],
      "enclosure": {
        "filesize": 123456789,
        "type":     "Media Type",
        "url":      "File Url"
      },
      "chapters": [
          {
              "start": 123456,
              "title": "Chapter Title"
          }
      ]
    }
  ]
}

```

## Usage Example with Callback

```js

var podson = require('podson');
var feedUrl = 'Podcast Feed URL';

function podsonTest(){

    podson.get(feedUrl, function(err, data) {
        if(err){
            console.log(err);
            return;
        }
        console.log(data);
    });
    
}

podsonTest();

```


## Usage Example with Async and Await

```js

const podson = require('podson');
const feedUrl = 'Podcast Feed URL';

async function podsonTest() {
    try {
        let result = await podson.getPodcast(feedUrl);
        console.log(result);

    } catch (err) {
        console.log(err);
    }
}

podsonTest();

```
