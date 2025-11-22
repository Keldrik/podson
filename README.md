# podson

Parses a remote podcast feed and returns a strongly typed object. Written in
TypeScript for modern Node.js projects.

## Installation

```bash
npm install podson
```

## Features

- Fetches and parses RSS/XML podcast feeds into clean JSON objects
- Full TypeScript support with comprehensive type definitions
- Automatic episode sorting by publication date (newest first)
- Supports podcast chapters, categories, and all standard RSS/iTunes fields
- Works with both ESM and CommonJS
- Built-in timeout handling and error management

## Output

The parsed podcast feed returns a `Podcast` object with the following structure:

```json
{
  "title": "Podcast Title",
  "subtitle": "Podcast Subtitle",
  "summary": "Podcast Summary",
  "description": "Podcast Description",
  "link": "https://podcast-website.com",
  "image": "https://podcast-image.com/cover.jpg",
  "language": "en-us",
  "author": "Podcast Author",
  "ttl": 60,
  "updated": "2024-01-15T10:00:00.000Z",
  "categories": ["Technology", "Technology>Podcasting"],
  "owner": {
    "name": "Owner Name",
    "email": "owner@example.com"
  },
  "feed": "https://example.com/podcast/feed.xml",
  "episodes": [
    {
      "guid": "episode-unique-id",
      "title": "Episode Title",
      "subtitle": "Episode Subtitle",
      "description": "Episode Description",
      "summary": "Episode Summary",
      "content": "<p>Full HTML content</p>",
      "image": "https://episode-image.com/cover.jpg",
      "published": "2024-01-15T10:00:00.000Z",
      "duration": 1845,
      "categories": ["Technology"],
      "enclosure": {
        "filesize": 123456789,
        "type": "audio/mpeg",
        "url": "https://example.com/episode.mp3"
      },
      "chapters": [
        {
          "start": 0,
          "title": "Introduction"
        },
        {
          "start": 300,
          "title": "Main Topic"
        }
      ]
    }
  ]
}
```

**Note:** Most fields are optional as not all podcast feeds include all metadata. The `categories` array is always present but may be empty.

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

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Type check
npm run typecheck

# Lint code
npm run lint
```
