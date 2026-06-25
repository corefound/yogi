import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';
import { wrapCache } from '../lib/redis-cache';

const type = () => {
    return `
        type UsersType {
            id: Int
            githubUserId: String
            githubLogin: String
            displayName: String
            avatarUrl: String
            profileUrl: String
            email: String
            role: String
            status: String
            lastLoginAt: String
            packages: [WithOutOwnerPackagesType]
        }

        type SingleUsersType {
            githubUserId: String
            githubLogin: String
            displayName: String
            avatarUrl: String
            profileUrl: String
            email: String
            role: String
            status: String
            lastLoginAt: String
        }
    `;
};

const inputTypes = () => {
    return `
        input CreateUserInput {
            githubUserId: Int!
            githubLogin: String!
            displayName: String
            avatarUrl: String
            profileUrl: String
            email: String
            role: String
            status: String
            lastLoginAt: String
        }

        input GetUserInput {
            name: String!
        }

        input UpdateUserInput {
            githubLogin: String
            displayName: String
            avatarUrl: String
            profileUrl: String
            email: String
            role: String
            status: String
            lastLoginAt: String
        }
    `;
};

const query = () => {
    return `
        user(name: String!): UsersType
        users(limit: Int, offset: Int, role: String): [UsersType]
        gayMaintainers: [UsersType]
    `;
};

const mutation = () => {
    return `
        createUser(input: CreateUserInput!): UsersType
        updateUser(name: String!, input: UpdateUserInput!): UsersType
        deleteUser(name: String!): Boolean
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        user: async (_: any, args: { name: string }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'user');
            const result = await Controllers.Users.user({ name: args.name }, fields);

            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'User not found');
            }
            return result.user;
        },
        users: async (_: any, args: { limit?: number; offset?: number; role?: string }, context: any, info: GraphQLResolveInfo) => {
            const cacheKey = `gql: users:${ args.role ?? 'all' }:${ args.limit ?? 'all' }:${ args.offset ?? '0' }`;
            return wrapCache(cacheKey, 20, async () => {
                const fields = getQueryResponseFields(info.fieldNodes, 'users');
                const result = await Controllers.Users.getUsers(args, fields);
                return result.users;
            });
        },
        gayMaintainers: async (_: any, __: any, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'users');
            const result = await Controllers.Users.getGayMaintainers(fields);
            return result.users;
        },
    },

    mutation: {
        createUser: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Users.createUser(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.user;
        },
        updateUser: async (_: any, args: { name: string; input: Record<string, unknown> }) => {
            const result = await Controllers.Users.updateUser({ name: args.name, input: args.input as any });
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Update failed');
            }
            return result.user;
        },
        deleteUser: async (_: any, args: { name: string }) => {
            const result = await Controllers.Users.deleteUser(args);
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Delete failed');
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
