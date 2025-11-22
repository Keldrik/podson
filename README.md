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

## Usage

### Basic Example

```ts
import { getPodcast } from 'podson';

const feedUrl = 'https://example.com/podcast/feed.xml';

(async () => {
  const podcast = await getPodcast(feedUrl);
  console.log(podcast.title);
})();
```

### Working with Episodes

Episodes are automatically sorted by publication date (newest first):

```ts
import { getPodcast } from 'podson';

const podcast = await getPodcast('https://example.com/podcast/feed.xml');

// Get the latest episode
if (podcast.episodes && podcast.episodes.length > 0) {
  const latest = podcast.episodes[0];
  console.log(`Latest episode: ${latest.title}`);
  console.log(`Published: ${latest.published}`);
  console.log(`Duration: ${latest.duration} seconds`);
  console.log(`Audio URL: ${latest.enclosure?.url}`);
}

// List all episodes
podcast.episodes?.forEach((episode) => {
  console.log(`- ${episode.title} (${episode.published})`);
});
```

### Error Handling

```ts
import { getPodcast } from 'podson';

try {
  const podcast = await getPodcast('https://example.com/podcast/feed.xml');
  console.log(`Successfully fetched: ${podcast.title}`);
} catch (error) {
  console.error('Failed to fetch podcast:', error.message);
  // Possible errors:
  // - Network timeout (after 10 seconds)
  // - HTTP errors (404, 500, etc.)
  // - XML parsing errors
}
```

### TypeScript Support

All types are fully documented and exported for use in your projects:

```ts
import { getPodcast, Podcast, Episode, Enclosure } from 'podson';

// The returned podcast object is fully typed
const podcast: Podcast = await getPodcast('https://example.com/feed.xml');

// Access properties with full IntelliSense support
const title: string | undefined = podcast.title;
const episodes: Episode[] | undefined = podcast.episodes;
const categories: string[] = podcast.categories; // Always present, may be empty
```

## Building

Run `npm run build` to compile the TypeScript source into the `dist` folder
before publishing.
