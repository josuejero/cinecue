export type TmdbSearchMovieResult = {
  id: number;
  title: string;
  release_date?: string | null;
  overview?: string | null;
  poster_path?: string | null;
};

export type TmdbSearchResponse = {
  results?: TmdbSearchMovieResult[];
};

export type TmdbFindResponse = {
  movie_results?: TmdbSearchMovieResult[];
};

export type TmdbMovieDetails = {
  id: number;
  title: string;
  original_title?: string;
  release_date?: string | null;
  overview?: string | null;
  runtime?: number | null;
  poster_path?: string | null;
  external_ids?: {
    imdb_id?: string | null;
  };
};
