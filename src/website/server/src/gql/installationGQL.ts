import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';

const type = () => {
    return `
        type InstallationType {
            id: Int
            packageId: Int
            packageVersionId: Int
            eventType: String
            platform: String
            arch: String
            os: String
            yogiVersion: String
            status: String
            sha256Matched: Boolean
            releaseIdMatched: Boolean
            assetNameMatched: Boolean
            assetIdMatched: Boolean
            assetSizeMatched: Boolean
            version: SingleVersionType
            createdAt: String
            updatedAt: String
        }

        type SingleInstallationType {
            id: Int
            packageId: Int
            packageVersionId: Int
            eventType: String
            platform: String
            arch: String
            os: String
            yogiVersion: String
            status: String
            sha256Matched: Boolean
            releaseIdMatched: Boolean
            assetNameMatched: Boolean
            assetIdMatched: Boolean
            assetSizeMatched: Boolean
            createdAt: String
            updatedAt: String
        }
    `;
};

const inputTypes = () => {
    return `
        input CreateInstallationInput {
            packageId: Int!
            packageVersionId: Int!
            eventType: String!
            platform: String!
            arch: String!
            os: String!
            yogiVersion: String!
            status: String!
            sha256Matched: Boolean!
            releaseIdMatched: Boolean!
            assetNameMatched: Boolean!
            assetIdMatched: Boolean!
            assetSizeMatched: Boolean!
        }

        input UpdateInstallationInput {
            eventType: String
            platform: String
            arch: String
            os: String
            yogiVersion: String
            status: String
            sha256Matched: Boolean
            releaseIdMatched: Boolean
            assetNameMatched: Boolean
            assetIdMatched: Boolean
            assetSizeMatched: Boolean
        }
    `;
};

const query = () => {
    return `
        installation(id: Int!): InstallationType
        installations(limit: Int, offset: Int): [InstallationType]
    `;
};

const mutation = () => {
    return `
        createInstallation(input: CreateInstallationInput!): InstallationType
        updateInstallation(id: Int!, input: UpdateInstallationInput!): InstallationType
        deleteInstallation(id: Int!): Boolean
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        installation: async (_: any, args: { id: number }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'installation');
            const result = await Controllers.Installations.getInstallation(args.id, fields);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.installation;
        },
        installations: async (_: any, args: { limit?: number; offset?: number }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'installations');
            const result = await Controllers.Installations.getInstallations(args, fields);
            return result.installations;
        },
    },

    mutation: {
        createInstallation: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Installations.createInstallation(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.installation;
        },
        updateInstallation: async (_: any, args: { id: number; input: Record<string, unknown> }) => {
            const result = await Controllers.Installations.updateInstallation({ id: args.id, input: args.input as any });
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Update failed');
            }
            return result.installation;
        },
        deleteInstallation: async (_: any, args: { id: number }) => {
            const result = await Controllers.Installations.deleteInstallation(args);
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
