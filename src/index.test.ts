import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPodcast } from './index';
import got from 'got';

// Mock the got module
vi.mock('got', () => ({
  default: vi.fn(),
}));

// Type for mock got response
type GotMockResponse = {
  text: () => Promise<string>;
};

// Type for HTTP errors
interface HttpError extends Error {
  response?: { statusCode: number };
}

// Helper function to create mock response
const createMockResponse = (xml: string): GotMockResponse => ({
  text: () => Promise.resolve(xml),
});

// Helper function to create mock error response
const createMockErrorResponse = (error: Error): GotMockResponse => ({
  text: () => Promise.reject(error),
});

describe('getPodcast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and parse a basic podcast feed', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <title>Test Podcast</title>
          <link>https://example.com</link>
          <language>en</language>
          <itunes:subtitle>A test podcast</itunes:subtitle>
          <itunes:author>Test Author</itunes:author>
          <description>This is a test podcast</description>
          <itunes:image href="https://example.com/image.jpg"/>
          <itunes:owner>
            <itunes:name>John Doe</itunes:name>
            <itunes:email>john@example.com</itunes:email>
          </itunes:owner>
          <itunes:category text="Technology"/>
          <item>
            <title>Episode 1</title>
            <guid>ep1</guid>
            <description>First episode</description>
            <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
            <itunes:duration>30:45</itunes:duration>
            <enclosure url="https://example.com/ep1.mp3" length="12345678" type="audio/mpeg"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');

    expect(result.title).toBe('Test Podcast');
    expect(result.link).toBe('https://example.com');
    expect(result.language).toBe('en-us');
    expect(result.subtitle).toBe('A test podcast');
    expect(result.author).toBe('Test Author');
    expect(result.description).toBe('This is a test podcast');
    expect(result.image).toBe('https://example.com/image.jpg');
    expect(result.feed).toBe('https://example.com/feed.xml');
    expect(result.owner).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
    });
    expect(result.categories).toEqual(['Technology']);
    expect(result.episodes).toHaveLength(1);
    expect(result.episodes?.[0].title).toBe('Episode 1');
    expect(result.episodes?.[0].guid).toBe('ep1');
    expect(result.episodes?.[0].duration).toBe(1845); // 30:45 in seconds
    expect(result.episodes?.[0].enclosure?.url).toBe(
      'https://example.com/ep1.mp3'
    );
  });

  it('should parse language codes correctly', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <language>de-DE</language>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.language).toBe('de-de');
  });

  it('should parse language codes without region correctly', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <language>de</language>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.language).toBe('de-de');
  });

  it.each([
    { input: '45', expected: 45, description: 'seconds only' },
    { input: '1:30', expected: 90, description: 'minutes:seconds' },
    { input: '1:30:45', expected: 5445, description: 'hours:minutes:seconds' },
  ])(
    'should parse duration in format $description ($input)',
    async ({ input, expected }) => {
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
          <channel>
            <item>
              <itunes:duration>${input}</itunes:duration>
            </item>
          </channel>
        </rss>`;

      (got as any).mockReturnValue(createMockResponse(mockXML));

      const result = await getPodcast('https://example.com/feed.xml');
      expect(result.episodes?.[0].duration).toBe(expected);
    }
  );

  it('should sort episodes by publication date (newest first)', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Old Episode</title>
            <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
          </item>
          <item>
            <title>New Episode</title>
            <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Middle Episode</title>
            <pubDate>Mon, 08 Jan 2024 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].title).toBe('New Episode');
    expect(result.episodes?.[1].title).toBe('Middle Episode');
    expect(result.episodes?.[2].title).toBe('Old Episode');
  });

  it('should set updated date from latest episode if not provided', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.updated).toEqual(new Date('Mon, 15 Jan 2024 10:00:00 GMT'));
  });

  it('should handle hierarchical categories', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <itunes:category text="Technology">
            <itunes:category text="Podcasting"/>
          </itunes:category>
          <itunes:category text="Arts"/>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.categories).toContain('Technology>Podcasting');
    expect(result.categories).toContain('Arts');
  });

  it('should handle episode categories', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <category>News</category>
            <category>Politics</category>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].categories).toEqual(['News', 'Politics']);
  });

  it('should parse episode chapters', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:psc="http://podlove.org/simple-chapters">
        <channel>
          <item>
            <psc:chapter start="0:00" title="Intro"/>
            <psc:chapter start="5:30" title="Main Topic"/>
            <psc:chapter start="25:15" title="Outro"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].chapters).toHaveLength(3);
    expect(result.episodes?.[0].chapters?.[0]).toEqual({
      start: 0,
      title: 'Intro',
    });
    expect(result.episodes?.[0].chapters?.[1]).toEqual({
      start: 330,
      title: 'Main Topic',
    });
    expect(result.episodes?.[0].chapters?.[2]).toEqual({
      start: 1515,
      title: 'Outro',
    });
  });

  it('should handle episode images', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <item>
            <itunes:image href="https://example.com/episode-image.jpg"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].image).toBe(
      'https://example.com/episode-image.jpg'
    );
  });

  it('should handle content:encoded field', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <item>
            <content:encoded><![CDATA[<p>Full HTML content here</p>]]></content:encoded>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].content).toBe('<p>Full HTML content here</p>');
  });

  it('should handle TTL (time to live)', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <ttl>60</ttl>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.ttl).toBe(60);
  });

  it('should handle pubDate in channel', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.updated).toEqual(new Date('Mon, 01 Jan 2024 10:00:00 GMT'));
  });

  it('should deduplicate and sort categories', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <itunes:category text="Technology"/>
          <itunes:category text="Arts"/>
          <itunes:category text="Technology"/>
          <itunes:category text="Business"/>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.categories).toEqual(['Arts', 'Business', 'Technology']);
  });

  it('should handle enclosure with all attributes', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <enclosure url="https://example.com/audio.mp3" length="12345678" type="audio/mpeg"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].enclosure).toEqual({
      url: 'https://example.com/audio.mp3',
      filesize: 12345678,
      type: 'audio/mpeg',
    });
  });

  it('should throw error on network timeout', async () => {
    const timeoutError = new Error('Timeout');
    timeoutError.name = 'TimeoutError';
    (got as any).mockReturnValue(createMockErrorResponse(timeoutError));

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Timeout fetching podcast feed: https://example.com/feed.xml'
    );
  });

  it('should throw error on HTTP error status', async () => {
    const httpError = new Error('Not Found') as HttpError;
    httpError.response = { statusCode: 404 };
    (got as any).mockReturnValue(createMockErrorResponse(httpError));

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Failed to fetch podcast (HTTP 404): https://example.com/feed.xml'
    );
  });

  it('should throw error on malformed XML', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Unclosed tag
        </channel>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Failed to parse podcast feed'
    );
  });

  it('should throw generic error for unknown errors', async () => {
    const unknownError = new Error('Unknown network error');
    (got as any).mockReturnValue(createMockErrorResponse(unknownError));

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Failed to fetch podcast: Unknown network error'
    );
  });

  it('should handle empty feed with no episodes', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Empty Podcast</title>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.title).toBe('Empty Podcast');
    expect(result.episodes).toBeUndefined();
    expect(result.updated).toBeNull();
  });

  it('should handle episodes without publication dates', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Episode without date</title>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].published).toBeUndefined();
  });

  it('should handle invalid duration format gracefully', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <item>
            <itunes:duration>invalid</itunes:duration>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].duration).toBe(0);
  });

  it('should handle subtitle and summary fields', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <itunes:subtitle>Channel Subtitle</itunes:subtitle>
          <itunes:summary>Channel Summary</itunes:summary>
          <item>
            <itunes:subtitle>Episode Subtitle</itunes:subtitle>
            <itunes:summary>Episode Summary</itunes:summary>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.subtitle).toBe('Channel Subtitle');
    expect(result.summary).toBe('Channel Summary');
    expect(result.episodes?.[0].subtitle).toBe('Episode Subtitle');
    expect(result.episodes?.[0].summary).toBe('Episode Summary');
  });

  it('should follow redirects and set timeout when fetching', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel><title>Test</title></channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    await getPodcast('https://example.com/feed.xml');

    expect(got).toHaveBeenCalledWith('https://example.com/feed.xml', {
      followRedirect: true,
      maxRedirects: 10,
      timeout: { request: 10000 },
    });
  });

  it('should handle chapters with milliseconds in timestamp', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:psc="http://podlove.org/simple-chapters">
        <channel>
          <item>
            <psc:chapter start="1:30.500" title="Chapter with milliseconds"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].chapters?.[0]).toEqual({
      start: 90, // milliseconds are stripped
      title: 'Chapter with milliseconds',
    });
  });

  // Enclosure edge cases
  it('should handle enclosure with missing length attribute', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <enclosure url="https://example.com/audio.mp3" type="audio/mpeg"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].enclosure).toEqual({
      url: 'https://example.com/audio.mp3',
      filesize: undefined,
      type: 'audio/mpeg',
    });
  });

  it('should handle enclosure with missing type attribute', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <enclosure url="https://example.com/audio.mp3" length="12345678"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].enclosure).toEqual({
      url: 'https://example.com/audio.mp3',
      filesize: 12345678,
      type: undefined,
    });
  });

  it('should handle enclosure with only url attribute', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <enclosure url="https://example.com/audio.mp3"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].enclosure).toEqual({
      url: 'https://example.com/audio.mp3',
      filesize: undefined,
      type: undefined,
    });
  });

  // Owner partial data tests
  it('should handle owner with only name', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <itunes:owner>
            <itunes:name>John Doe</itunes:name>
          </itunes:owner>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.owner).toEqual({
      name: 'John Doe',
    });
  });

  it('should handle owner with only email', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <itunes:owner>
            <itunes:email>john@example.com</itunes:email>
          </itunes:owner>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.owner).toEqual({
      email: 'john@example.com',
    });
  });

  it('should handle empty owner tag', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <itunes:owner>
          </itunes:owner>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.owner).toEqual({});
  });

  // Chapter edge cases
  it('should skip chapter with missing start attribute', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:psc="http://podlove.org/simple-chapters">
        <channel>
          <item>
            <psc:chapter title="No Start Time"/>
            <psc:chapter start="1:00" title="Valid Chapter"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].chapters).toHaveLength(1);
    expect(result.episodes?.[0].chapters?.[0]).toEqual({
      start: 60,
      title: 'Valid Chapter',
    });
  });

  it('should skip chapter with missing title attribute', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:psc="http://podlove.org/simple-chapters">
        <channel>
          <item>
            <psc:chapter start="1:00"/>
            <psc:chapter start="2:00" title="Valid Chapter"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].chapters).toHaveLength(1);
    expect(result.episodes?.[0].chapters?.[0]).toEqual({
      start: 120,
      title: 'Valid Chapter',
    });
  });

  // parseTime edge cases
  it.each([
    { input: ':::', expected: 0, description: 'only colons' },
    { input: '::', expected: 0, description: 'double colons' },
    { input: 'abc:def:ghi', expected: 0, description: 'non-numeric text' },
    { input: '0', expected: 0, description: 'zero' },
    { input: '0:0', expected: 0, description: 'zero minutes and seconds' },
    { input: '0:0:0', expected: 0, description: 'all zeros' },
  ])(
    'should handle invalid duration: $description ($input)',
    async ({ input, expected }) => {
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
          <channel>
            <item>
              <itunes:duration>${input}</itunes:duration>
            </item>
          </channel>
        </rss>`;

      (got as any).mockReturnValue(createMockResponse(mockXML));

      const result = await getPodcast('https://example.com/feed.xml');
      expect(result.episodes?.[0].duration).toBe(expected);
    }
  );

  // Episode sorting edge cases
  it('should handle all episodes without publication dates', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Episode 1</title>
          </item>
          <item>
            <title>Episode 2</title>
          </item>
          <item>
            <title>Episode 3</title>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes).toHaveLength(3);
    // Without dates, order should be preserved from feed
    expect(result.episodes?.[0].title).toBe('Episode 1');
    expect(result.episodes?.[1].title).toBe('Episode 2');
    expect(result.episodes?.[2].title).toBe('Episode 3');
  });

  it('should handle mix of episodes with and without dates', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Episode with Date</title>
            <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Episode without Date 1</title>
          </item>
          <item>
            <title>Episode without Date 2</title>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes).toHaveLength(3);
    // Episode with date should come first
    expect(result.episodes?.[0].title).toBe('Episode with Date');
  });

  it('should handle episodes with identical publication dates', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Episode A</title>
            <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Episode B</title>
            <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Episode C</title>
            <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes).toHaveLength(3);
    // Order should be stable for same dates
  });

  // Updated date precedence tests
  it('should prefer channel pubDate over episode dates for updated field', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <pubDate>Mon, 20 Jan 2024 10:00:00 GMT</pubDate>
          <item>
            <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.updated).toEqual(new Date('Mon, 20 Jan 2024 10:00:00 GMT'));
  });

  it('should set updated to null when episodes exist but have no dates', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>Episode without date</title>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.updated).toBeNull();
  });

  // Deeper hierarchical categories
  it('should handle deeply nested hierarchical categories', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <itunes:category text="Arts">
            <itunes:category text="Design">
              <itunes:category text="Graphic Design">
                <itunes:category text="Typography"/>
              </itunes:category>
            </itunes:category>
          </itunes:category>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.categories).toContain(
      'Arts>Design>Graphic Design>Typography'
    );
  });

  it('should handle category with empty text attribute', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <itunes:category text=""/>
          <itunes:category text="Technology"/>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.categories).toEqual(['Technology']);
  });

  // More language code tests
  it.each([
    { input: 'en', expected: 'en-us', description: 'special case for en' },
    { input: 'fr', expected: 'fr-fr', description: 'duplicates region' },
    { input: 'ja', expected: 'ja-ja', description: 'non-western language' },
    { input: 'EN-US', expected: 'en-us', description: 'uppercase' },
    { input: 'En-Us', expected: 'en-us', description: 'mixed case' },
  ])(
    'should parse language code: $description ($input)',
    async ({ input, expected }) => {
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <language>${input}</language>
          </channel>
        </rss>`;

      (got as any).mockReturnValue(createMockResponse(mockXML));

      const result = await getPodcast('https://example.com/feed.xml');
      expect(result.language).toBe(expected);
    }
  );

  // More HTTP error status tests
  it.each([
    { statusCode: 500, description: 'Internal Server Error' },
    { statusCode: 403, description: 'Forbidden' },
    { statusCode: 503, description: 'Service Unavailable' },
  ])(
    'should throw error on HTTP $statusCode ($description)',
    async ({ statusCode }) => {
      const httpError = new Error('HTTP Error') as HttpError;
      httpError.response = { statusCode };

      (got as any).mockReturnValue(createMockErrorResponse(httpError));

      await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
        `Failed to fetch podcast (HTTP ${statusCode}): https://example.com/feed.xml`
      );
    }
  );

  // Categories array initialization
  it('should always initialize categories as an empty array', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Minimal Feed</title>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(Array.isArray(result.categories)).toBe(true);
    expect(result.categories).toHaveLength(0);
  });

  // More invalid XML edge cases
  it('should handle empty string gracefully', async () => {
    (got as any).mockReturnValue(createMockResponse(''));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result).toBeDefined();
    expect(result.categories).toEqual([]);
  });

  it('should throw error on non-XML content', async () => {
    (got as any).mockReturnValue(createMockResponse('This is not XML'));

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Failed to parse podcast feed'
    );
  });

  it('should throw error on XML with wrong root element', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <notRss>
        <channel>
          <title>Wrong Root</title>
        </channel>
      </notRss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    // Should parse but likely have unexpected results
    expect(result).toBeDefined();
  });

  // Episode description/summary/content tests
  it('should handle episode with only description', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <description>Episode description only</description>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].description).toBe('Episode description only');
    expect(result.episodes?.[0].summary).toBeUndefined();
    expect(result.episodes?.[0].content).toBeUndefined();
  });

  it('should handle episode with both description and summary', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
        <channel>
          <item>
            <description>Episode description</description>
            <itunes:summary>Episode summary</itunes:summary>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].description).toBe('Episode description');
    expect(result.episodes?.[0].summary).toBe('Episode summary');
  });

  it('should handle episode with description, summary, and content', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <item>
            <description>Episode description</description>
            <itunes:summary>Episode summary</itunes:summary>
            <content:encoded><![CDATA[<p>Full HTML content</p>]]></content:encoded>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].description).toBe('Episode description');
    expect(result.episodes?.[0].summary).toBe('Episode summary');
    expect(result.episodes?.[0].content).toBe('<p>Full HTML content</p>');
  });

  it('should handle complex real-world podcast feed', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"
        xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
        xmlns:content="http://purl.org/rss/1.0/modules/content/"
        xmlns:psc="http://podlove.org/simple-chapters">
        <channel>
          <title>Tech Talk Podcast</title>
          <link>https://techtalk.example.com</link>
          <language>en-US</language>
          <itunes:subtitle>The best tech podcast</itunes:subtitle>
          <itunes:author>Tech Team</itunes:author>
          <description>Weekly discussions about technology</description>
          <itunes:summary>Deep dive into tech topics</itunes:summary>
          <itunes:image href="https://techtalk.example.com/cover.jpg"/>
          <itunes:owner>
            <itunes:name>Jane Smith</itunes:name>
            <itunes:email>jane@techtalk.example.com</itunes:email>
          </itunes:owner>
          <itunes:category text="Technology">
            <itunes:category text="Tech News"/>
          </itunes:category>
          <ttl>60</ttl>
          <pubDate>Mon, 15 Jan 2024 12:00:00 GMT</pubDate>

          <item>
            <title>AI Revolution</title>
            <guid>ep-123</guid>
            <itunes:subtitle>Discussing AI trends</itunes:subtitle>
            <description>Latest in AI technology</description>
            <itunes:summary>A deep dive into AI</itunes:summary>
            <content:encoded><![CDATA[<p>Full show notes here</p>]]></content:encoded>
            <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
            <itunes:duration>45:30</itunes:duration>
            <itunes:image href="https://techtalk.example.com/ep123.jpg"/>
            <enclosure url="https://techtalk.example.com/ep123.mp3" length="54321000" type="audio/mpeg"/>
            <category>Technology</category>
            <category>AI</category>
            <psc:chapter start="0:00" title="Introduction"/>
            <psc:chapter start="5:00" title="AI News"/>
            <psc:chapter start="30:00" title="Interview"/>
            <psc:chapter start="44:00" title="Outro"/>
          </item>

          <item>
            <title>Cloud Computing</title>
            <guid>ep-122</guid>
            <description>Understanding the cloud</description>
            <pubDate>Mon, 08 Jan 2024 10:00:00 GMT</pubDate>
            <itunes:duration>38:15</itunes:duration>
            <enclosure url="https://techtalk.example.com/ep122.mp3" length="45678000" type="audio/mpeg"/>
          </item>
        </channel>
      </rss>`;

    (got as any).mockReturnValue(createMockResponse(mockXML));

    const result = await getPodcast('https://techtalk.example.com/feed.xml');

    // Channel metadata
    expect(result.title).toBe('Tech Talk Podcast');
    expect(result.link).toBe('https://techtalk.example.com');
    expect(result.language).toBe('en-us');
    expect(result.subtitle).toBe('The best tech podcast');
    expect(result.author).toBe('Tech Team');
    expect(result.description).toBe('Weekly discussions about technology');
    expect(result.summary).toBe('Deep dive into tech topics');
    expect(result.image).toBe('https://techtalk.example.com/cover.jpg');
    expect(result.ttl).toBe(60);
    expect(result.updated).toEqual(new Date('Mon, 15 Jan 2024 12:00:00 GMT'));
    expect(result.feed).toBe('https://techtalk.example.com/feed.xml');
    expect(result.owner).toEqual({
      name: 'Jane Smith',
      email: 'jane@techtalk.example.com',
    });
    expect(result.categories).toEqual(['Technology', 'Technology>Tech News']);

    // Episodes
    expect(result.episodes).toHaveLength(2);

    // First episode (newest)
    const ep1 = result.episodes![0];
    expect(ep1.title).toBe('AI Revolution');
    expect(ep1.guid).toBe('ep-123');
    expect(ep1.subtitle).toBe('Discussing AI trends');
    expect(ep1.description).toBe('Latest in AI technology');
    expect(ep1.summary).toBe('A deep dive into AI');
    expect(ep1.content).toBe('<p>Full show notes here</p>');
    expect(ep1.duration).toBe(2730); // 45:30 in seconds
    expect(ep1.image).toBe('https://techtalk.example.com/ep123.jpg');
    expect(ep1.enclosure).toEqual({
      url: 'https://techtalk.example.com/ep123.mp3',
      filesize: 54321000,
      type: 'audio/mpeg',
    });
    expect(ep1.categories).toEqual(['Technology', 'AI']);
    expect(ep1.chapters).toHaveLength(4);
    expect(ep1.chapters![0]).toEqual({ start: 0, title: 'Introduction' });
    expect(ep1.chapters![1]).toEqual({ start: 300, title: 'AI News' });

    // Second episode
    const ep2 = result.episodes![1];
    expect(ep2.title).toBe('Cloud Computing');
    expect(ep2.duration).toBe(2295); // 38:15 in seconds
  });
});
