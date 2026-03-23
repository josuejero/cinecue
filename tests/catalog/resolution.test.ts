import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/shared/http/errors";

const getDb = vi.fn();
const getTmdbMovieDetails = vi.fn();
const findTmdbMovieByImdbId = vi.fn();
const searchTmdbMovies = vi.fn();

vi.mock("@/db/client", () => ({
  getDb: () => getDb(),
}));

vi.mock("@/integrations/tmdb/client", () => ({
  getTmdbMovieDetails: (...args: unknown[]) => getTmdbMovieDetails(...args),
  findTmdbMovieByImdbId: (...args: unknown[]) => findTmdbMovieByImdbId(...args),
  searchTmdbMovies: (...args: unknown[]) => searchTmdbMovies(...args),
}));

import { resolveOrCreateMovieFromTmdbId } from "@/modules/catalog/resolution";

function createSelectChain<T>(rows: T[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  };
}

function createDb(selectResults: unknown[][]) {
  let selectIndex = 0;
  const insertValuesCalls: Array<{ values: unknown }> = [];
  const updateSetCalls: Array<{ values: unknown }> = [];

  const db = {
    select: vi.fn(() => createSelectChain(selectResults[selectIndex++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertValuesCalls.push({ values });
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updateSetCalls.push({ values });
        return {
          where: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
  };

  return { db, insertValuesCalls, updateSetCalls };
}

describe("catalog resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findTmdbMovieByImdbId.mockResolvedValue(null);
    searchTmdbMovies.mockResolvedValue([]);
  });

  it("reuses an existing movie when the TMDB external id is already linked", async () => {
    const { db, insertValuesCalls, updateSetCalls } = createDb([[{ movieId: "movie_existing" }]]);
    getDb.mockReturnValue(db);
    getTmdbMovieDetails.mockResolvedValue({
      id: 550,
      title: "Fight Club",
      release_date: "1999-10-15",
      overview: "Catalog refresh",
      runtime: 139,
      poster_path: "/fight.jpg",
      external_ids: {},
    });

    const result = await resolveOrCreateMovieFromTmdbId("550");

    expect(result).toEqual({ movieId: "movie_existing", created: false });
    expect(updateSetCalls[0]?.values).toMatchObject({
      canonicalTitle: "Fight Club",
      normalizedTitle: "fight club",
      releaseYear: 1999,
      releaseDate: "1999-10-15",
      shortDescription: "Catalog refresh",
      runtimeMinutes: 139,
      posterUrl: "https://image.tmdb.org/t/p/w500/fight.jpg",
    });
    expect(insertValuesCalls).toHaveLength(1);
    expect(insertValuesCalls[0].values).toMatchObject({
      movieId: "movie_existing",
      provider: "tmdb",
      externalType: "tmdbId",
      externalId: "550",
    });
  });

  it("creates a new movie and stores TMDB plus IMDb ids when no match exists", async () => {
    const { db, insertValuesCalls } = createDb([[], [], []]);
    getDb.mockReturnValue(db);
    getTmdbMovieDetails.mockResolvedValue({
      id: 550,
      title: "Fight Club",
      release_date: "1999-10-15",
      overview: "Mischief and soap.",
      runtime: 139,
      poster_path: "/fight.jpg",
      external_ids: { imdb_id: "tt0137523" },
    });

    const result = await resolveOrCreateMovieFromTmdbId("550");

    expect(result.created).toBe(true);
    expect(insertValuesCalls).toHaveLength(3);
    expect(insertValuesCalls[0].values).toMatchObject({
      canonicalTitle: "Fight Club",
      normalizedTitle: "fight club",
      releaseYear: 1999,
      releaseDate: "1999-10-15",
      shortDescription: "Mischief and soap.",
      runtimeMinutes: 139,
      posterUrl: "https://image.tmdb.org/t/p/w500/fight.jpg",
    });
    expect(insertValuesCalls.slice(1).map((call) => call.values)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "imdb",
          externalType: "imdbId",
          externalId: "tt0137523",
        }),
        expect.objectContaining({
          provider: "tmdb",
          externalType: "tmdbId",
          externalId: "550",
        }),
      ]),
    );
  });

  it("throws ConflictError when TMDB import matches multiple catalog movies", async () => {
    const { db, insertValuesCalls } = createDb([
      [],
      [
        {
          id: "movie_1",
          normalizedTitle: "halloween",
          releaseYear: 1978,
        },
        {
          id: "movie_2",
          normalizedTitle: "halloween",
          releaseYear: 1978,
        },
      ],
    ]);
    getDb.mockReturnValue(db);
    getTmdbMovieDetails.mockResolvedValue({
      id: 123,
      title: "Halloween",
      release_date: "1978-10-25",
      overview: "Ambiguous classic.",
      runtime: 91,
      poster_path: null,
      external_ids: {},
    });

    await expect(resolveOrCreateMovieFromTmdbId("123")).rejects.toBeInstanceOf(ConflictError);
    expect(insertValuesCalls).toHaveLength(1);
    expect(insertValuesCalls[0].values).toMatchObject({
      normalizedTitle: "halloween",
      reason: "Multiple exact title/year matches exist.",
      status: "open",
    });
  });
});
