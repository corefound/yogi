import { GraphQLError } from 'graphql';
import { Controllers } from '../controllers';
import { wrapCache, delCacheByPattern } from '../lib/redis-cache';

const type = () => {
    return `
        type MetricsType {
            id: Int
            key: String
            value: Int
            label: String
            body: JSON
            createdAt: String
            updatedAt: String
        }
    `;
};

const inputTypes = () => {
    return `
        input CreateMetricInput {
            key: String!
            value: Int!
            label: String
            body: JSON
        }

        input UpdateMetricInput {
            value: Int
            label: String
            body: JSON
        }
    `;
};

const query = () => {
    return `
        metrics: [MetricsType]
        metric(key: String!): MetricsType
    `;
};

const mutation = () => {
    return `
        createMetric(input: CreateMetricInput!): MetricsType
        updateMetric(key: String!, input: UpdateMetricInput!): MetricsType
        upsertMetric(input: CreateMetricInput!): MetricsType
        deleteMetric(key: String!): Boolean
        refreshMetrics: [MetricsType]
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        metrics: async () => {
            return wrapCache('gql:metrics', 30, async () => {
                const result = await Controllers.Metrics.getAllMetrics();
                return result.metrics;
            });
        },
        metric: async (_: any, args: { key: string }) => {
            return wrapCache(`gql:metric:${args.key}`, 60, async () => {
                const result = await Controllers.Metrics.getMetric(args.key);
                if (result.error) {
                    const err = result.error as { message?: string };
                    throw new GraphQLError(err.message || 'Metric not found');
                }
                return result.metric;
            });
        },
    },

    mutation: {
        createMetric: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Metrics.createMetric(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            await delCacheByPattern('gql:metrics*');
            return result.metric;
        },
        updateMetric: async (_: any, args: { key: string; input: Record<string, unknown> }) => {
            const result = await Controllers.Metrics.updateMetric({ key: args.key, input: args.input as any });
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Update failed');
            }
            await delCacheByPattern('gql:metrics*');
            return result.metric;
        },
        upsertMetric: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Metrics.upsertMetric(args.input as any);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            await delCacheByPattern('gql:metrics*');
            return result.metric;
        },
        deleteMetric: async (_: any, args: { key: string }) => {
            const result = await Controllers.Metrics.deleteMetric(args.key);
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Delete failed');
            }
            await delCacheByPattern('gql:metrics*');
            return result.success;
        },
        refreshMetrics: async () => {
            const result = await Controllers.Metrics.refreshMetrics();
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            await delCacheByPattern('gql:metrics*');
            return result.metrics;
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
