import { eq, and, desc, gte, lte, type SQL } from "drizzle-orm";
import { getPgDb } from "../../../db/postgres.init.js";
import { interviewResultsTable } from "../../interview/schemas/result.schema.js";
import { interviewsTable } from "../../interview/schemas/interview.schema.js";
import { redisClient } from "../../../config/redis.init.js";

interface UserAnalytics {
  overallStats: {
    totalInterviews: number;
    avgOverallScore: number | null;
    avgTechnicalScore: number | null;
    avgCommunicationScore: number | null;
    avgProblemSolvingScore: number | null;
    avgConfidenceScore: number | null;
    totalQuestionsAnswered: number;
    totalQuestionsSkipped: number;
    completionRate: number;
  };
  trendData: {
    date: string;
    overallScore: number;
    technicalScore: number;
    communicationScore: number;
  }[];
  categoryBreakdown: {
    strengths: Record<string, number>;
    weaknesses: Record<string, number>;
  };
  performanceByCategory: {
    category: string;
    avgScore: number;
    count: number;
  }[];
}

/**
 * Get user analytics with caching
 */
export async function getUserAnalytics(userId: string, dateRange?: { from?: Date; to?: Date }): Promise<UserAnalytics> {
  // Try to get from cache first
  const cacheKey = `analytics:user:${userId}`;
  const cachedResult = await redisClient.get(cacheKey);
  
  if (cachedResult) {
    return JSON.parse(cachedResult);
  }

  // Fetch from database if not in cache
  const analytics = await _fetchUserAnalyticsFromDb(userId, dateRange);

  // Cache for 5 minutes
  await redisClient.setex(cacheKey, 300, JSON.stringify(analytics));

  return analytics;
}

/**
 * Internal function to fetch analytics from database
 */
async function _fetchUserAnalyticsFromDb(userId: string, dateRange?: { from?: Date; to?: Date }): Promise<UserAnalytics> {
  const db = getPgDb();

  // Join interview and interview results tables to filter by userId.
  // Conditions are collected first and applied as ONE predicate: Drizzle's
  // `.where()` *replaces* the previous predicate rather than ANDing with it, so
  // reassigning a query that already carried the userId filter silently dropped
  // it whenever a date range was supplied. Building the predicate up-front also
  // lets Drizzle infer the selected row type, which is what the previous
  // `as any` assertions were suppressing.
  const conditions: SQL<unknown>[] = [eq(interviewsTable.userId, userId)];
  if (dateRange?.from) {
    conditions.push(gte(interviewResultsTable.createdAt, dateRange.from));
  }
  if (dateRange?.to) {
    conditions.push(lte(interviewResultsTable.createdAt, dateRange.to));
  }

  const results = await db
    .select({
      // Results fields
      id: interviewResultsTable.id,
      overallScore: interviewResultsTable.overallScore,
      technicalScore: interviewResultsTable.technicalScore,
      communicationScore: interviewResultsTable.communicationScore,
      problemSolvingScore: interviewResultsTable.problemSolvingScore,
      confidenceScore: interviewResultsTable.confidenceScore,
      questionsAnswered: interviewResultsTable.questionsAnswered,
      questionsSkipped: interviewResultsTable.questionsSkipped,
      strengths: interviewResultsTable.strengths,
      weaknesses: interviewResultsTable.weaknesses,
      createdAt: interviewResultsTable.createdAt,
    })
    .from(interviewResultsTable)
    .innerJoin(interviewsTable, eq(interviewResultsTable.interviewId, interviewsTable.id))
    .where(and(...conditions))
    .orderBy(desc(interviewResultsTable.createdAt));

  if (results.length === 0) {
    // Return empty analytics object
    return {
      overallStats: {
        totalInterviews: 0,
        avgOverallScore: null,
        avgTechnicalScore: null,
        avgCommunicationScore: null,
        avgProblemSolvingScore: null,
        avgConfidenceScore: null,
        totalQuestionsAnswered: 0,
        totalQuestionsSkipped: 0,
        completionRate: 0,
      },
      trendData: [],
      categoryBreakdown: {
        strengths: {},
        weaknesses: {},
      },
      performanceByCategory: [],
    };
  }

  // Calculate overall stats
  const totalInterviews = results.length;
  const avgOverallScore = results.reduce((sum: number, r) => sum + (parseFloat(r.overallScore.toString())), 0) / totalInterviews;
  const avgTechnicalScore = results.reduce((sum: number, r) => sum + (parseFloat(r.technicalScore.toString())), 0) / totalInterviews;
  const avgCommunicationScore = results.reduce((sum: number, r) => sum + (parseFloat(r.communicationScore.toString())), 0) / totalInterviews;
  const avgProblemSolvingScore = results.reduce((sum: number, r) => sum + (parseFloat(r.problemSolvingScore.toString())), 0) / totalInterviews;
  const avgConfidenceScore = results.reduce((sum: number, r) => sum + (parseFloat(r.confidenceScore.toString())), 0) / totalInterviews;
  
  const totalQuestionsAnswered = results.reduce((sum: number, r) => sum + (r.questionsAnswered ?? 0), 0);
  const totalQuestionsSkipped = results.reduce((sum: number, r) => sum + (r.questionsSkipped ?? 0), 0);
  const completionRate = totalInterviews > 0 
    ? (totalQuestionsAnswered / (totalQuestionsAnswered + totalQuestionsSkipped)) * 100 
    : 0;

  // Calculate trend data (score over time)
  const trendData = results.map((r) => ({
    // ISO timestamps are fixed-width, so the date is the first 10 characters.
    // This is always a string — the previous `|| new Date()` fallback was dead.
    date: r.createdAt.toISOString().slice(0, 10),
    overallScore: parseFloat(r.overallScore.toString()),
    technicalScore: parseFloat(r.technicalScore.toString()),
    communicationScore: parseFloat(r.communicationScore.toString()),
  })).reverse(); // Reverse to show oldest first

  // Calculate category breakdown from strengths/weaknesses arrays
  const strengthsMap: Record<string, number> = {};
  const weaknessesMap: Record<string, number> = {};

  results.forEach((r) => {
    r.strengths.forEach((s) => {
      strengthsMap[s] = (strengthsMap[s] ?? 0) + 1;
    });

    r.weaknesses.forEach((w) => {
      weaknessesMap[w] = (weaknessesMap[w] ?? 0) + 1;
    });
  });

  // Group performance by category (we'll use strengths and weaknesses as categories)
  const allCategories = new Set([...Object.keys(strengthsMap), ...Object.keys(weaknessesMap)]);
  const performanceByCategory: UserAnalytics["performanceByCategory"] = [];

  for (const category of allCategories) {
    const categoryResults = results.filter(
      (r) => r.strengths.includes(category) || r.weaknesses.includes(category),
    );

    if (categoryResults.length > 0) {
      const avgScore = categoryResults.reduce((sum: number, r) => {
        const overall = parseFloat(r.overallScore.toString());
        const technical = parseFloat(r.technicalScore.toString());
        const communication = parseFloat(r.communicationScore.toString());
        return sum + ((overall + technical + communication) / 3);
      }, 0) / categoryResults.length;
      
      performanceByCategory.push({
        category,
        avgScore: parseFloat(avgScore.toFixed(2)),
        count: categoryResults.length,
      });
    }
  }

  return {
    overallStats: {
      totalInterviews,
      avgOverallScore: avgOverallScore ? parseFloat(avgOverallScore.toFixed(2)) : null,
      avgTechnicalScore: avgTechnicalScore ? parseFloat(avgTechnicalScore.toFixed(2)) : null,
      avgCommunicationScore: avgCommunicationScore ? parseFloat(avgCommunicationScore.toFixed(2)) : null,
      avgProblemSolvingScore: avgProblemSolvingScore ? parseFloat(avgProblemSolvingScore.toFixed(2)) : null,
      avgConfidenceScore: avgConfidenceScore ? parseFloat(avgConfidenceScore.toFixed(2)) : null,
      totalQuestionsAnswered,
      totalQuestionsSkipped,
      completionRate: parseFloat(completionRate.toFixed(2)),
    },
    trendData,
    categoryBreakdown: {
      strengths: strengthsMap,
      weaknesses: weaknessesMap,
    },
    performanceByCategory,
  };
}

/**
 * Clear cached analytics for a user
 */
export async function clearUserAnalyticsCache(userId: string): Promise<void> {
  const cacheKey = `analytics:user:${userId}`;
  await redisClient.del(cacheKey);
}