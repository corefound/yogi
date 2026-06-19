import { GraphQLError } from 'graphql';
import { Controllers } from '../controllers';

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
    `;
};

const query = () => {
    return ``;
};

const mutation = () => {
    return `
        createInstallation(input: CreateInstallationInput!): InstallationType
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {},

    mutation: {
        createInstallation: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Installations.createInstallation(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.installation;
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