import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooManyRequestsError } from "@/shared/http/errors";

const getOrCreateAppUser = vi.fn();
const resolveUserLocation = vi.fn();
const getFollowedMovieIds = vi.fn();
const loadDashboard = vi.fn();
const loadMovieDetail = vi.fn();
const createFollow = vi.fn();
const refreshSelectedMovieLocalStatuses = vi.fn();
const refreshMovieLocalStatusForLocation = vi.fn();
const trackProductEvent = vi.fn();
const readDashboardCache = vi.fn();
const writeDashboardCache = vi.fn();
const invalidateDashboardCacheForUser = vi.fn();
const markLocationUsed = vi.fn();
const createSavedLocationForUser = vi.fn();
const listUserSavedLocations = vi.fn();
const setDefaultSavedLocation = vi.fn();
const addFavoriteTheatre = vi.fn();
const listFavoriteTheatreIds = vi.fn();
const removeFavoriteTheatre = vi.fn();
const removeFollow = vi.fn();
const searchMoviesForFollowFlow = vi.fn();
const assertRateLimit = vi.fn();

vi.mock("@/modules/auth/server", () => ({
  getOrCreateAppUser: () => getOrCreateAppUser(),
}));

vi.mock("@/modules/locations/server", () => ({
  resolveUserLocation: (...args: unknown[]) => resolveUserLocation(...args),
  markLocationUsed: (...args: unknown[]) => markLocationUsed(...args),
  createSavedLocationForUser: (...args: unknown[]) => createSavedLocationForUser(...args),
  listUserSavedLocations: (...args: unknown[]) => listUserSavedLocations(...args),
  setDefaultSavedLocation: (...args: unknown[]) => setDefaultSavedLocation(...args),
  addFavoriteTheatre: (...args: unknown[]) => addFavoriteTheatre(...args),
  listFavoriteTheatreIds: (...args: unknown[]) => listFavoriteTheatreIds(...args),
  removeFavoriteTheatre: (...args: unknown[]) => removeFavoriteTheatre(...args),
}));

vi.mock("@/modules/availability/queries", () => ({
  loadDashboard: (...args: unknown[]) => loadDashboard(...args),
  listAvailabilityChanges: vi.fn(),
}));

vi.mock("@/modules/follows/server", () => ({
  getFollowedMovieIds: (...args: unknown[]) => getFollowedMovieIds(...args),
  createFollow: (...args: unknown[]) => createFollow(...args),
  removeFollow: (...args: unknown[]) => removeFollow(...args),
}));

vi.mock("@/modules/catalog/server", () => ({
  loadMovieDetail: (...args: unknown[]) => loadMovieDetail(...args),
}));

vi.mock("@/modules/availability/read-model", () => ({
  refreshSelectedMovieLocalStatuses: (...args: unknown[]) =>
    refreshSelectedMovieLocalStatuses(...args),
  refreshMovieLocalStatusForLocation: (...args: unknown[]) =>
    refreshMovieLocalStatusForLocation(...args),
}));

vi.mock("@/modules/analytics/server", () => ({
  trackProductEvent: (...args: unknown[]) => trackProductEvent(...args),
}));

vi.mock("@/modules/availability/dashboard-cache", () => ({
  readDashboardCache: (...args: unknown[]) => readDashboardCache(...args),
  writeDashboardCache: (...args: unknown[]) => writeDashboardCache(...args),
  invalidateDashboardCacheForUser: (...args: unknown[]) =>
    invalidateDashboardCacheForUser(...args),
}));

vi.mock("@/modules/search/server", () => ({
  searchMoviesForFollowFlow: (...args: unknown[]) => searchMoviesForFollowFlow(...args),
}));

vi.mock("@/shared/infra/rate-limit", () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
}));

import { GET as dashboardGet } from "@/app/api/dashboard/route";
import { POST as followPost } from "@/app/api/follows/route";
import { DELETE as followDelete } from "@/app/api/follows/[movieId]/route";
import {
  POST as favoritePost,
  DELETE as favoriteDelete,
} from "@/app/api/locations/[locationId]/favorite-theatres/route";
import { POST as locationsPost, PATCH as locationsPatch } from "@/app/api/locations/route";
import { GET as searchGet } from "@/app/api/search/movies/route";

describe("web routes", () => {
  const user = { id: "user_1" };
  const location = {
    userLocationId: "saved_1",
    locationId: "loc_1",
    normalizedKey: "zip:10001",
    postalCode: "10001",
    radiusMiles: 25,
    label: "Home",
    isDefault: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getOrCreateAppUser.mockResolvedValue(user);
    resolveUserLocation.mockResolvedValue(location);
    markLocationUsed.mockResolvedValue(undefined);
    invalidateDashboardCacheForUser.mockResolvedValue(1);
    trackProductEvent.mockResolvedValue(undefined);
    assertRateLimit.mockResolvedValue({ key: "rate:test", count: 1, remaining: 59 });
    createFollow.mockResolvedValue(undefined);
    removeFollow.mockResolvedValue(undefined);
  });

  it("returns cached dashboard payloads, records a dashboard_view event, and rate limits by user", async () => {
    const cached = { location, totalFollows: 2, sections: [] };
    readDashboardCache.mockResolvedValueOnce(cached);

    const response = await dashboardGet(
      new Request("http://localhost/api/dashboard?locationId=loc_1"),
    );

    await expect(response.json()).resolves.toEqual(cached);
    expect(assertRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "dashboard",
        subject: user.id,
        limit: 60,
        windowSeconds: 60,
      }),
    );
    expect(loadDashboard).not.toHaveBeenCalled();
    expect(trackProductEvent).toHaveBeenCalledWith({
      userId: user.id,
      locationId: location.locationId,
      eventName: "dashboard_view",
      properties: { refresh: false, cacheHit: true },
    });
  });

  it("returns 429 when dashboard requests are throttled", async () => {
    assertRateLimit.mockRejectedValueOnce(
      new TooManyRequestsError("Too many requests. Please try again shortly.", 17),
    );

    const response = await dashboardGet(
      new Request("http://localhost/api/dashboard?locationId=loc_1"),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    await expect(response.json()).resolves.toEqual({
      error: "Too many requests. Please try again shortly.",
    });
    expect(loadDashboard).not.toHaveBeenCalled();
  });

  it("bypasses cache on refresh and refreshes followed movie statuses", async () => {
    getFollowedMovieIds.mockResolvedValueOnce(["movie_1"]);
    loadDashboard.mockResolvedValueOnce({ totalFollows: 1, sections: [] });

    const response = await dashboardGet(
      new Request("http://localhost/api/dashboard?locationId=loc_1&refresh=true"),
    );

    await expect(response.json()).resolves.toEqual({
      location,
      totalFollows: 1,
      sections: [],
    });
    expect(readDashboardCache).not.toHaveBeenCalled();
    expect(refreshSelectedMovieLocalStatuses).toHaveBeenCalledWith("loc_1", ["movie_1"]);
    expect(writeDashboardCache).toHaveBeenCalled();
  });

  it("tracks search events without changing the search response contract", async () => {
    const results = [{ movieId: "movie_1", title: "The Batman", isFollowed: true }];
    searchMoviesForFollowFlow.mockResolvedValueOnce(results);

    const response = await searchGet(
      new Request("http://localhost/api/search/movies?q=batman&locationId=loc_1"),
    );

    await expect(response.json()).resolves.toEqual({ query: "batman", location, results });
    expect(trackProductEvent).toHaveBeenCalledWith({
      userId: user.id,
      locationId: location.locationId,
      eventName: "search",
      properties: { queryLength: 6, resultCount: 1 },
    });
  });

  it("tracks follow events and invalidates dashboard cache", async () => {
    loadMovieDetail.mockResolvedValueOnce({ movie: { movieId: "movie_1" } });
    refreshMovieLocalStatusForLocation.mockResolvedValueOnce(undefined);

    const response = await followPost(
      new Request("http://localhost/api/follows", {
        method: "POST",
        body: JSON.stringify({ movieId: "movie_1", locationId: "loc_1" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createFollow).toHaveBeenCalledWith({
      userId: user.id,
      movieId: "movie_1",
      locationId: location.locationId,
    });
    expect(invalidateDashboardCacheForUser).toHaveBeenCalledWith(user.id);
    expect(trackProductEvent).toHaveBeenCalledWith({
      userId: user.id,
      locationId: location.locationId,
      movieId: "movie_1",
      eventName: "follow",
      properties: {},
    });
  });

  it("tracks unfollow events and invalidates dashboard cache", async () => {
    const response = await followDelete(
      new Request("http://localhost/api/follows/movie_1?locationId=loc_1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ movieId: "movie_1" }) },
    );

    await expect(response.json()).resolves.toEqual({
      removed: true,
      movieId: "movie_1",
      locationId: "loc_1",
    });
    expect(removeFollow).toHaveBeenCalledWith({
      userId: user.id,
      locationId: location.locationId,
      movieId: "movie_1",
    });
    expect(trackProductEvent).toHaveBeenCalledWith({
      userId: user.id,
      locationId: location.locationId,
      movieId: "movie_1",
      eventName: "unfollow",
      properties: {},
    });
  });

  it("tracks location saves and returns the updated saved-location list", async () => {
    createSavedLocationForUser.mockResolvedValueOnce("loc_2");
    listUserSavedLocations.mockResolvedValueOnce([
      location,
      {
        ...location,
        userLocationId: "saved_2",
        locationId: "loc_2",
        label: "Work",
        isDefault: false,
      },
    ]);

    const response = await locationsPost(
      new Request("http://localhost/api/locations", {
        method: "POST",
        body: JSON.stringify({ postalCode: "10002", label: "Work", radiusMiles: 15 }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createSavedLocationForUser).toHaveBeenCalled();
    expect(trackProductEvent).toHaveBeenCalledWith({
      userId: user.id,
      locationId: "loc_2",
      eventName: "location_saved",
      properties: { makeDefault: false, mode: "zip" },
    });
  });

  it("tracks default-location changes via PATCH /api/locations", async () => {
    listUserSavedLocations.mockResolvedValueOnce([location]);

    const response = await locationsPatch(
      new Request("http://localhost/api/locations", {
        method: "PATCH",
        body: JSON.stringify({ locationId: "loc_1", makeDefault: true }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      location,
      locations: [location],
    });
    expect(setDefaultSavedLocation).toHaveBeenCalledWith(user.id, "loc_1");
    expect(trackProductEvent).toHaveBeenCalledWith({
      userId: user.id,
      locationId: "loc_1",
      eventName: "location_default_changed",
      properties: {},
    });
  });

  it("tracks favorite theatre adds and removals", async () => {
    listFavoriteTheatreIds.mockResolvedValueOnce(["theatre_1"]).mockResolvedValueOnce([]);

    const addResponse = await favoritePost(
      new Request("http://localhost/api/locations/loc_1/favorite-theatres", {
        method: "POST",
        body: JSON.stringify({ theatreId: "theatre_1" }),
      }),
      { params: Promise.resolve({ locationId: "loc_1" }) },
    );
    const removeResponse = await favoriteDelete(
      new Request("http://localhost/api/locations/loc_1/favorite-theatres", {
        method: "DELETE",
        body: JSON.stringify({ theatreId: "theatre_1" }),
      }),
      { params: Promise.resolve({ locationId: "loc_1" }) },
    );

    await expect(addResponse.json()).resolves.toEqual({
      ok: true,
      favoriteTheatreIds: ["theatre_1"],
    });
    await expect(removeResponse.json()).resolves.toEqual({
      ok: true,
      favoriteTheatreIds: [],
    });
    expect(addFavoriteTheatre).toHaveBeenCalledWith({
      userId: user.id,
      locationId: "loc_1",
      theatreId: "theatre_1",
    });
    expect(removeFavoriteTheatre).toHaveBeenCalledWith({
      userId: user.id,
      locationId: "loc_1",
      theatreId: "theatre_1",
    });
    expect(trackProductEvent).toHaveBeenNthCalledWith(1, {
      userId: user.id,
      locationId: "loc_1",
      eventName: "favorite_theatre_added",
      properties: { theatreId: "theatre_1" },
    });
    expect(trackProductEvent).toHaveBeenNthCalledWith(2, {
      userId: user.id,
      locationId: "loc_1",
      eventName: "favorite_theatre_removed",
      properties: { theatreId: "theatre_1" },
    });
  });
});
