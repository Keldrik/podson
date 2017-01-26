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

## Usage

```js
const podson = require('podson');

podson('podcast Url', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  console.log(data);
});
```