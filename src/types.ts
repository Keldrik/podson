export interface Chapter {
  start: number;
  title: string;
}

export interface Enclosure {
  filesize?: number;
  type?: string;
  url?: string;
}

export interface Episode {
  guid?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  summary?: string;
  content?: string;
  image?: string;
  published?: Date;
  duration?: number;
  categories?: string[];
  enclosure?: Enclosure;
  chapters?: Chapter[];
}

export interface Owner {
  name?: string;
  email?: string;
}

export interface Podcast {
  title?: string;
  subtitle?: string;
  summary?: string;
  description?: string;
  link?: string;
  image?: string;
  language?: string;
  copyright?: string;
  author?: string;
  ttl?: number;
  updated?: Date | null;
  categories: string[];
  owner?: Owner;
  episodes?: Episode[];
  feed?: string;
}
