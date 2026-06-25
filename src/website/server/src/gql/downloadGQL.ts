import { GraphQLError } from 'graphql';
import { Controllers } from '../controllers';
import { wrapCache, delCacheByPattern } from '../lib/redis-cache';

const type = () => {
    return `
        type DownloadStatsType {
            totalDownloads: Int
            weeklyDownloads: Int
            periodDownloads: Int
            period: String
            downloadTrend: [JSON]
        }
    `;
};

const inputTypes = () => {
    return `
        input RecordDownloadInput {
            packageId: Int!
        }

        input DownloadStatsInput {
            packageId: Int
            period: String
        }
    `;
};

const query = () => {
    return `
        downloadStats(input: DownloadStatsInput!): DownloadStatsType
    `;
};

const mutation = () => {
    return `
        recordDownload(input: RecordDownloadInput!): Boolean
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        downloadStats: async (_: any, args: { input: Record<string, unknown> }) => {
            const pkgId = (args.input as any).packageId;
            const period = (args.input as any).period || 'all';
            return wrapCache(`gql:downloadStats:${pkgId}:${period}`, 20, async () => {
                const result = await Controllers.Downloads.getDownloadStats(args.input);
                if (result.error) {
                    const err = result.error as { message?: string };
                    throw new GraphQLError(err.message || 'Failed to get download stats');
                }
                return result;
            });
        },
    },

    mutation: {
        recordDownload: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Downloads.recordDownload(args.input);
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Failed to record download');
            }
            const pkgId = (args.input as any).packageId;
            await delCacheByPattern('gql:downloadStats:*');
            if (pkgId) {
                await delCacheByPattern('gql:package:*');
                await delCacheByPattern('gql:packages:*');
                await delCacheByPattern('gql:trendingPackages:*');
            }
            return result.success;
        },
    },

    subscription: {},
};

export default {
    type,
    query,
    mutation,
    subscription,
    inputTypes,
    resolvers,
};
