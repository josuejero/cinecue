import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { movies, userMovieFollows } from "@/db/schema";
import { normalizeTitle } from "@/lib/normalize";

export function scoreMovieSearchCandidate(
  normalizedTitle: string,
  normalizedQuery: string,
  releaseYear: number | null = null,
) {
  let score = 0;

  if (normalizedTitle === normalizedQuery) {
    score += 500;
  } else if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 300;
  } else if (normalizedTitle.includes(normalizedQuery)) {
    score += 200;
  }

  if (releaseYear != null) {
    score += Math.min(Math.max(releaseYear - 1900, 0), 200) / 10;
  }

  return score;
}

export async function searchMoviesForFollowFlowPhase6(input: {
  userId: string;
  locationId: string;
  query: string;
  limit?: number;
}) {
  const db = getDb();
  const normalizedQuery = normalizeTitle(input.query);
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));

  if (normalizedQuery.length < 2) {
    return [];
  }

  const containsValue = `%${normalizedQuery}%`;
  const startsWithValue = `${normalizedQuery}%`;
  const similaritySql = sql<number>`similarity(${movies.normalizedTitle}, ${normalizedQuery})`;
  const rankSql = sql<number>`
    (
      case
        when ${movies.normalizedTitle} = ${normalizedQuery} then 500
        when ${movies.normalizedTitle} like ${startsWithValue} then 300
        when ${movies.normalizedTitle} like ${containsValue} then 200
        else 0
      end
    ) + (${similaritySql} * 100)
  `;

  const rows = await db
    .select({
      movieId: movies.id,
      title: movies.canonicalTitle,
      releaseYear: movies.releaseYear,
      releaseDate: movies.releaseDate,
      posterUrl: movies.posterUrl,
      shortDescription: movies.shortDescription,
      similarity: similaritySql,
      rank: rankSql,
    })
    .from(movies)
    .where(
      sql`${movies.normalizedTitle} % ${normalizedQuery} or ${movies.normalizedTitle} like ${containsValue}`,
    )
    .orderBy(desc(rankSql), desc(similaritySql), desc(movies.releaseYear), asc(movies.canonicalTitle))
    .limit(limit);

  if (!rows.length) {
    return [];
  }

  const followedRows = await db
    .select({ movieId: userMovieFollows.movieId })
    .from(userMovieFollows)
    .where(
      and(
        eq(userMovieFollows.userId, input.userId),
        eq(userMovieFollows.locationId, input.locationId),
        inArray(
          userMovieFollows.movieId,
          rows.map((row) => row.movieId),
        ),
      ),
    );

  const followedSet = new Set(followedRows.map((row) => row.movieId));

  return rows.map((row) => ({
    movieId: row.movieId,
    title: row.title,
    releaseYear: row.releaseYear ?? null,
    releaseDate: row.releaseDate ?? null,
    posterUrl: row.posterUrl ?? null,
    shortDescription: row.shortDescription ?? null,
    isFollowed: followedSet.has(row.movieId),
  }));
}
