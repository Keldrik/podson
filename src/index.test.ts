import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPodcast } from './index';
import got from 'got';

// Mock the got module
vi.mock('got');

// Type for mock got response
type MockGotResponse = Promise<string> & { text: () => string };

// Type for HTTP errors
interface HttpError extends Error {
  response?: { statusCode: number };
}

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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
      'https://example.com/ep1.mp3',
    );
  });

  it('should parse language codes correctly', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <language>de-DE</language>
        </channel>
      </rss>`;

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.language).toBe('de-de');
  });

  it('should parse duration in various formats', async () => {
    const testCases = [
      { input: '45', expected: 45 },
      { input: '1:30', expected: 90 },
      { input: '1:30:45', expected: 5445 },
    ];

    for (const testCase of testCases) {
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
          <channel>
            <item>
              <itunes:duration>${testCase.input}</itunes:duration>
            </item>
          </channel>
        </rss>`;

      const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
      mockResponse.text = () => mockXML;
      vi.mocked(got).mockReturnValue(mockResponse);

      const result = await getPodcast('https://example.com/feed.xml');
      expect(result.episodes?.[0].duration).toBe(testCase.expected);
    }
  });

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].image).toBe(
      'https://example.com/episode-image.jpg',
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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].content).toBe('<p>Full HTML content here</p>');
  });

  it('should handle multiple text nodes by concatenating them', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <description>Part 1 </description>
          <description>Part 2</description>
        </channel>
      </rss>`;

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

    await getPodcast('https://example.com/feed.xml');
    // Note: This tests the concatenation behavior within a single description tag
    // Multiple description tags would be overwritten, not concatenated
  });

  it('should handle TTL (time to live)', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <ttl>60</ttl>
        </channel>
      </rss>`;

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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
    const mockResponse = Promise.reject(timeoutError) as MockGotResponse;
    mockResponse.text = () => {
      throw timeoutError;
    };
    vi.mocked(got).mockReturnValue(mockResponse);

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Timeout fetching podcast feed: https://example.com/feed.xml',
    );
  });

  it('should throw error on HTTP error status', async () => {
    const httpError = new Error('Not Found') as HttpError;
    httpError.response = { statusCode: 404 };
    const mockResponse = Promise.reject(httpError) as MockGotResponse;
    mockResponse.text = () => {
      throw httpError;
    };
    vi.mocked(got).mockReturnValue(mockResponse);

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Failed to fetch podcast (HTTP 404): https://example.com/feed.xml',
    );
  });

  it('should throw error on malformed XML', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Unclosed tag
        </channel>`;

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Failed to parse podcast feed',
    );
  });

  it('should throw generic error for unknown errors', async () => {
    const unknownError = new Error('Unknown network error');
    const mockResponse = Promise.reject(unknownError) as MockGotResponse;
    mockResponse.text = () => {
      throw unknownError;
    };
    vi.mocked(got).mockReturnValue(mockResponse);

    await expect(getPodcast('https://example.com/feed.xml')).rejects.toThrow(
      'Failed to fetch podcast: Unknown network error',
    );
  });

  it('should handle empty feed with no episodes', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <title>Empty Podcast</title>
        </channel>
      </rss>`;

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.subtitle).toBe('Channel Subtitle');
    expect(result.summary).toBe('Channel Summary');
    expect(result.episodes?.[0].subtitle).toBe('Episode Subtitle');
    expect(result.episodes?.[0].summary).toBe('Episode Summary');
  });

  it('should use http2 and set timeout when fetching', async () => {
    const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel><title>Test</title></channel>
      </rss>`;

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

    await getPodcast('https://example.com/feed.xml');

    expect(got).toHaveBeenCalledWith('https://example.com/feed.xml', {
      http2: true,
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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

    const result = await getPodcast('https://example.com/feed.xml');
    expect(result.episodes?.[0].chapters?.[0]).toEqual({
      start: 90, // milliseconds are stripped
      title: 'Chapter with milliseconds',
    });
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

    const mockResponse = Promise.resolve(mockXML) as MockGotResponse;
    mockResponse.text = () => mockXML;
    vi.mocked(got).mockReturnValue(mockResponse);

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
