export type MovieSearchImportSource = {
  provider: "tmdb";
  tmdbId: string;
};

export type MovieSearchResult = {
  resultKey: string;
  movieId: string | null;
  title: string;
  releaseYear: number | null;
  releaseDate: string | null;
  posterUrl: string | null;
  shortDescription: string | null;
  isFollowed: boolean;
  isInCatalog: boolean;
  importSource: MovieSearchImportSource | null;
};
