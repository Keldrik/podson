/**
 * Represents a chapter marker within a podcast episode.
 * Chapters allow listeners to navigate to specific sections of an episode.
 */
export interface Chapter {
  /** Start time of the chapter in seconds from the beginning of the episode */
  start: number;
  /** Title/name of the chapter */
  title: string;
}

/**
 * Represents the media file attachment for a podcast episode.
 * Contains information about the audio/video file that can be downloaded or streamed.
 */
export interface Enclosure {
  /** Size of the media file in bytes */
  filesize?: number;
  /** MIME type of the media file (e.g., 'audio/mpeg', 'audio/mp4') */
  type?: string;
  /** Direct URL to the media file */
  url?: string;
}

/**
 * Represents a single podcast episode.
 * Contains metadata and content information for an individual episode.
 */
export interface Episode {
  /** Globally unique identifier for the episode */
  guid?: string;
  /** Episode title */
  title?: string;
  /** Short subtitle or tagline for the episode */
  subtitle?: string;
  /** Plain text description of the episode */
  description?: string;
  /** Summary of the episode (may overlap with description) */
  summary?: string;
  /** Full HTML content/show notes for the episode */
  content?: string;
  /** URL to the episode's artwork/cover image */
  image?: string;
  /** Publication date and time of the episode */
  published?: Date;
  /** Duration of the episode in seconds */
  duration?: number;
  /** List of categories/tags associated with this episode */
  categories?: string[];
  /** Media file information (audio/video file to play) */
  enclosure?: Enclosure;
  /** Chapter markers for navigation within the episode */
  chapters?: Chapter[];
}

/**
 * Represents the owner/creator of a podcast.
 * Contains contact information for the podcast owner.
 */
export interface Owner {
  /** Name of the podcast owner */
  name?: string;
  /** Contact email address for the podcast owner */
  email?: string;
}

/**
 * Represents a complete podcast feed with all its metadata and episodes.
 * This is the main data structure returned by the getPodcast() function.
 *
 * @remarks
 * - Episodes are automatically sorted by publication date (newest first)
 * - Categories use '>' as a separator for hierarchical categories (e.g., 'Technology>Podcasting')
 * - Most fields are optional as not all podcast feeds include all metadata
 */
export interface Podcast {
  /** Podcast title/name */
  title?: string;
  /** Short subtitle or tagline for the podcast */
  subtitle?: string;
  /** Brief summary of the podcast */
  summary?: string;
  /** Detailed description of the podcast */
  description?: string;
  /** URL to the podcast's website */
  link?: string;
  /** URL to the podcast's cover artwork */
  image?: string;
  /** Language code in format 'en-us', 'de-de', etc. */
  language?: string;
  /** Copyright notice for the podcast */
  copyright?: string;
  /** Primary author/creator of the podcast */
  author?: string;
  /** Time-to-live in minutes - suggested update frequency */
  ttl?: number;
  /** Last update date (derived from most recent episode if not provided in feed) */
  updated?: Date | null;
  /** Array of podcast categories, sorted alphabetically. Hierarchical categories use '>' separator */
  categories: string[];
  /** Podcast owner/contact information */
  owner?: Owner;
  /** Array of episodes, sorted by publication date (newest first) */
  episodes?: Episode[];
  /** URL of the original RSS/XML feed */
  feed?: string;
}
