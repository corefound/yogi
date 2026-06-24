import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';
import { wrapCache, delCacheByPattern } from '../lib/redis-cache';

const type = () => {
    return `
        type OrganizationType {
            id: Int
            name: String
            displayName: String
            description: String
            avatarUrl: String
            ownerUserId: Int
            status: String
            createdAt: String
            updatedAt: String
            owner: SingleUsersType
            packages: [WithOutOwnerPackagesType]
        }
    `;
};

const inputTypes = () => {
    return `
        input CreateOrganizationInput {
            name: String!
            displayName: String
            description: String
            avatarUrl: String
            ownerUserId: Int!
        }

        input UpdateOrganizationInput {
            displayName: String
            description: String
            avatarUrl: String
            status: String
        }
    `;
};

const query = () => {
    return `
        organizations(limit: Int, offset: Int): [OrganizationType]
        popularOrganizations(limit: Int): [OrganizationType]
        organization(name: String!): OrganizationType
        organizationPackages(orgId: Int!): [WithOutOwnerPackagesType]
    `;
};

const mutation = () => {
    return `
        createOrganization(input: CreateOrganizationInput!): OrganizationType
        updateOrganization(orgId: Int!, input: UpdateOrganizationInput!): OrganizationType
        deleteOrganization(orgId: Int!): Boolean
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        organizations: async (_: any, args: { limit?: number; offset?: number }, context: any, info: GraphQLResolveInfo) => {
            const cacheKey = `gql:organizations:${args.limit ?? 'all'}:${args.offset ?? '0'}`;
            return wrapCache(cacheKey, 60, async () => {
                const fields = getQueryResponseFields(info.fieldNodes, 'organizations');
                const result = await Controllers.Organizations.getAllOrganizations(args, fields);
                return result.organizations;
            });
        },
        popularOrganizations: async (_: any, args: { limit?: number }) => {
            const cacheKey = `gql:popularOrganizations:${ args.limit ?? '3' }`;
            return wrapCache(cacheKey, 120, async () => {
                const result = await Controllers.Organizations.getPopularOrganizations({ limit: args.limit });
                return result.organizations;
            });
        },
        organization: async (_: any, args: { name: string }, context: any, info: GraphQLResolveInfo) => {
            return wrapCache(`gql:organization:${args.name}`, 60, async () => {
                const fields = getQueryResponseFields(info.fieldNodes, 'organization');
                const result = await Controllers.Organizations.getOrganization(args, fields);
                if (result.error) {
                    const err = result.error as { message?: string };
                    throw new GraphQLError(err.message || 'Organization not found');
                }
                return result.organization;
            });
        },
        organizationPackages: async (_: any, args: { orgId: number }, context: any, info: GraphQLResolveInfo) => {
            return wrapCache(`gql:organizationPackages:${args.orgId}`, 60, async () => {
                const fields = getQueryResponseFields(info.fieldNodes, 'organizationPackages');
                const result = await Controllers.Organizations.getOrganizationPackages(args, fields);
                if (result.error) {
                    throw new GraphQLError(String(result.error));
                }
                return result.packages;
            });
        },
    },

    mutation: {
        createOrganization: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Organizations.createOrganization(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            await delCacheByPattern('gql:organizations:*');
            return result.organization;
        },
        updateOrganization: async (_: any, args: { orgId: number; input: Record<string, unknown> }) => {
            const result = await Controllers.Organizations.updateOrganization({ orgId: args.orgId, input: args.input as any });
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Update failed');
            }
            await delCacheByPattern('gql:organizations:*');
            return result.organization;
        },
        deleteOrganization: async (_: any, args: { orgId: number }) => {
            const result = await Controllers.Organizations.deleteOrganization(args);
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Delete failed');
            }
            await delCacheByPattern('gql:organizations:*');
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
