import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';

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
            const fields = getQueryResponseFields(info.fieldNodes, 'organizations');
            const result = await Controllers.Organizations.getAllOrganizations(args, fields);
            return result.organizations;
        },
        organization: async (_: any, args: { name: string }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'organization');
            const result = await Controllers.Organizations.getOrganization(args, fields);
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Organization not found');
            }
            return result.organization;
        },
        organizationPackages: async (_: any, args: { orgId: number }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'organizationPackages');
            const result = await Controllers.Organizations.getOrganizationPackages(args, fields);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.packages;
        },
    },

    mutation: {
        createOrganization: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Organizations.createOrganization(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.organization;
        },
        updateOrganization: async (_: any, args: { orgId: number; input: Record<string, unknown> }) => {
            const result = await Controllers.Organizations.updateOrganization({ orgId: args.orgId, input: args.input as any });
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Update failed');
            }
            return result.organization;
        },
        deleteOrganization: async (_: any, args: { orgId: number }) => {
            const result = await Controllers.Organizations.deleteOrganization(args);
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
