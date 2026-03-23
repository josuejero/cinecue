import { beforeEach, describe, expect, it, vi } from "vitest";

const getDb = vi.fn();
const searchTmdbMovies = vi.fn();

vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

vi.mock("@/integrations/tmdb/client", () => ({
  searchTmdbMovies: (...args: unknown[]) => searchTmdbMovies(...args),
}));

import {
  scoreMovieSearchCandidate,
  searchMoviesForFollowFlow,
} from "@/modules/search/server";

function createWhereResult<T>(rows: T[]) {
  return Object.assign(Promise.resolve(rows), {
    orderBy: vi.fn(() => ({
      limit: vi.fn().mockResolvedValue(rows),
    })),
    limit: vi.fn().mockResolvedValue(rows),
  });
}

function createDb(selectResults: unknown[][]) {
  let index = 0;

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => createWhereResult(selectResults[index++] ?? [])),
      })),
    })),
  };
}

describe("search scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers exact title matches over prefix and contains matches", () => {
    const exact = scoreMovieSearchCandidate("the batman", "the batman", 2022);
    const startsWith = scoreMovieSearchCandidate("the batman begins", "the batman", 2005);
    const contains = scoreMovieSearchCandidate("lego the batman story", "the batman", 2017);

    expect(exact).toBeGreaterThan(startsWith);
    expect(startsWith).toBeGreaterThan(contains);
  });

  it("keeps searches local-only when five strong catalog results already exist", async () => {
    getDb.mockReturnValue(
      createDb([
        [
          {
            movieId: "movie_1",
            title: "Batman",
            normalizedTitle: "batman",
            releaseYear: 1989,
            releaseDate: "1989-06-23",
            posterUrl: null,
            shortDescription: null,
            score: 550,
          },
          {
            movieId: "movie_2",
            title: "Batman Returns",
            normalizedTitle: "batman returns",
            releaseYear: 1992,
            releaseDate: "1992-06-19",
            posterUrl: null,
            shortDescription: null,
            score: 340,
          },
          {
            movieId: "movie_3",
            title: "Batman Forever",
            normalizedTitle: "batman forever",
            releaseYear: 1995,
            releaseDate: "1995-06-16",
            posterUrl: null,
            shortDescription: null,
            score: 330,
          },
          {
            movieId: "movie_4",
            title: "Batman Begins",
            normalizedTitle: "batman begins",
            releaseYear: 2005,
            releaseDate: "2005-06-15",
            posterUrl: null,
            shortDescription: null,
            score: 320,
          },
          {
            movieId: "movie_5",
            title: "The Batman",
            normalizedTitle: "the batman",
            releaseYear: 2022,
            releaseDate: "2022-03-04",
            posterUrl: null,
            shortDescription: null,
            score: 310,
          },
        ],
        [{ movieId: "movie_1" }],
      ]),
    );
    searchTmdbMovies.mockResolvedValue([]);

    const results = await searchMoviesForFollowFlow({
      userId: "user_1",
      locationId: "loc_1",
      query: "Batman",
      limit: 10,
    });

    expect(searchTmdbMovies).not.toHaveBeenCalled();
    expect(results).toHaveLength(5);
    expect(results[0]).toMatchObject({
      resultKey: "movie:movie_1",
      movieId: "movie_1",
      isFollowed: true,
      isInCatalog: true,
      importSource: null,
    });
  });

  it("returns remote-only TMDB hits when local coverage is weak", async () => {
    getDb.mockReturnValue(createDb([[ ], [ ]]));
    searchTmdbMovies.mockResolvedValue([
      {
        id: 550,
        title: "Fight Club",
        release_date: "1999-10-15",
        overview: "Mischief and soap.",
        poster_path: "/fight.jpg",
      },
    ]);

    const results = await searchMoviesForFollowFlow({
      userId: "user_1",
      locationId: "loc_1",
      query: "Fight Club",
      limit: 10,
    });

    expect(searchTmdbMovies).toHaveBeenCalledWith("Fight Club");
    expect(results).toEqual([
      {
        resultKey: "tmdb:550",
        movieId: null,
        title: "Fight Club",
        releaseYear: 1999,
        releaseDate: "1999-10-15",
        posterUrl: "https://image.tmdb.org/t/p/w500/fight.jpg",
        shortDescription: "Mischief and soap.",
        isFollowed: false,
        isInCatalog: false,
        importSource: { provider: "tmdb", tmdbId: "550" },
      },
    ]);
  });

  it("collapses TMDB hits already linked in the catalog back to local movie rows", async () => {
    getDb.mockReturnValue(
      createDb([
        [],
        [{ tmdbId: "550", movieId: "movie_1" }],
        [
          {
            movieId: "movie_1",
            title: "Fight Club",
            normalizedTitle: "fight club",
            releaseYear: 1999,
            releaseDate: "1999-10-15",
            posterUrl: null,
            shortDescription: "Catalog copy",
          },
        ],
        [{ movieId: "movie_1" }],
      ]),
    );
    searchTmdbMovies.mockResolvedValue([
      {
        id: 550,
        title: "Fight Club",
        release_date: "1999-10-15",
        overview: "TMDB copy",
        poster_path: "/fight.jpg",
      },
    ]);

    const results = await searchMoviesForFollowFlow({
      userId: "user_1",
      locationId: "loc_1",
      query: "Fight Club",
      limit: 10,
    });

    expect(results).toEqual([
      {
        resultKey: "movie:movie_1",
        movieId: "movie_1",
        title: "Fight Club",
        releaseYear: 1999,
        releaseDate: "1999-10-15",
        posterUrl: null,
        shortDescription: "Catalog copy",
        isFollowed: true,
        isInCatalog: true,
        importSource: null,
      },
    ]);
  });

  it("dedupes remote TMDB hits that already match a returned catalog movie", async () => {
    getDb.mockReturnValue(
      createDb([
        [
          {
            movieId: "movie_1",
            title: "Fight Club",
            normalizedTitle: "fight club",
            releaseYear: 1999,
            releaseDate: "1999-10-15",
            posterUrl: null,
            shortDescription: "Catalog copy",
            score: 550,
          },
        ],
        [],
        [{ movieId: "movie_1" }],
      ]),
    );
    searchTmdbMovies.mockResolvedValue([
      {
        id: 550,
        title: "Fight Club",
        release_date: "1999-10-15",
        overview: "TMDB copy",
        poster_path: "/fight.jpg",
      },
    ]);

    const results = await searchMoviesForFollowFlow({
      userId: "user_1",
      locationId: "loc_1",
      query: "Fight Club",
      limit: 10,
    });

    expect(searchTmdbMovies).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      resultKey: "movie:movie_1",
      movieId: "movie_1",
      importSource: null,
    });
  });
});
