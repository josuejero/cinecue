export type RawGracenoteTheatre = {
  id: string | number;
  name: string;
  chain?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat?: string | number;
  lng?: string | number;
  phone?: string;
  timeZone?: string;
};

export type RawGracenoteShowtime = {
  theatre: {
    id: string | number;
    name: string;
  };
  dateTime: string;
  quals?: string;
  ticketURI?: string;
  barg?: boolean;
};

export type RawGracenoteMovie = {
  tmsId?: string;
  rootId?: string | number;
  title: string;
  releaseYear?: number;
  releaseDate?: string;
  entityType?: string;
  subType?: string;
  shortDescription?: string;
  longDescription?: string;
  runTime?: string;
  preferredImage?: {
    uri?: string;
  };
  showtimes?: RawGracenoteShowtime[];
};

export type RawGracenoteFutureRelease = {
  tmsId?: string;
  rootId?: string | number;
  title: string;
  releaseYear?: number;
  releaseDate?: string;
  entityType?: string;
  subType?: string;
  shortDescription?: string;
  longDescription?: string;
  runTime?: string;
  preferredImage?: {
    uri?: string;
  };
  releases?: Array<{
    date: string;
    country?: string;
    type?: string;
    distributors?: Array<{ name?: string }>;
  }>;
};
