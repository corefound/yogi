import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';

const type = () => {
    return `
        type VersionType {
            id: Int
            packageId: Int
            version: String
            description: String
            readmeText: String
            license: String
            assetSizeBytes: String
            installCount: String
            status: String
            publishedAt: String
            createdAt: String
            updatedAt: String
            package: SinglePackagesType
            installations: [InstallationType]
        }

        type WithoutPackagesVersionType {
            id: Int
            packageId: Int
            version: String
            description: String
            readmeText: String
            license: String
            assetSizeBytes: String
            installCount: String
            status: String
            publishedAt: String
            createdAt: String
            updatedAt: String
            installations: [InstallationType]
        }

        type SingleVersionType {
            id: Int
            packageId: Int
            version: String
            description: String
            readmeText: String
            license: String
            assetSizeBytes: String
            installCount: String
            status: String
            publishedAt: String
            createdAt: String
            updatedAt: String
        }
    `;
};

const inputTypes = () => {
    return `
        input CreatePackageVersionInput {
            packageId: Int!
            version: String!
            description: String
            readmeText: String
            license: String
            assetSizeBytes: Int
            status: String
        }

        input GetPackageVersionInput {
            packageName: String!
            version: String!
        }
    `;
};

const query = () => {
    return `
        version(packageName: String!, version: String!): VersionType
    `;
};

const mutation = () => {
    return `
        createVersion(input: CreatePackageVersionInput!): SingleVersionType
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        version: async (_: any, args: { packageName: string; version: string }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'version');
            const result = await Controllers.PackageVersion.version({ packageName: args.packageName, version: args.version, }, fields);
            
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Package version not found');
            }
            return result.version;
        },
    },

    mutation: {
        createVersion: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.PackageVersion.createVersion(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.version;
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