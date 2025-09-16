# podson

Parses a remote podcast feed and returns a strongly typed object. Written in
TypeScript for modern Node.js projects.

## Output

```json
{
  "title": "Podcast Title",
  "summary": "Podcast Summary",
  "description": "Podcast Description",
  "link": "Podcast Link",
  "image": "Podcast Image",
  "language": "Language",
  "copyright": "Copyright",
  "updated": "PubDate",
  "categories": ["Category", "Category Subcategory"],
  "owner": {
    "name": "Author Name",
    "email": "Author Email"
  },
  "episodes": [
    {
      "guid": "Unique Id",
      "title": "Episode Title",
      "subtitle": "Episode Subtitle",
      "description": "Episode Description",
      "summary": "Episode Summary",
      "content": "<Content Encoded>",
      "image": "Episode Image",
      "published": "Date",
      "duration": 456,
      "categories": ["Category"],
      "enclosure": {
        "filesize": 123456789,
        "type": "Media Type",
        "url": "File Url"
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

## Usage Example with Async and Await

```ts
import { getPodcast } from 'podson';

const feedUrl = 'Podcast Feed URL';

(async () => {
  const podcast = await getPodcast(feedUrl);
  console.log(podcast.title);
})();
```

## Building

Run `npm run build` to compile the TypeScript source into the `dist` folder
before publishing.
