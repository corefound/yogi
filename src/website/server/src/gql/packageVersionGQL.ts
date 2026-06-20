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
            minifiedSizeBytes: String
            installCount: String
            checksum: String
            tarballUrl: String
            status: String
            publishedAt: String
            publishedByUserId: Int
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
            minifiedSizeBytes: String
            installCount: String
            checksum: String
            tarballUrl: String
            status: String
            publishedAt: String
            publishedByUserId: Int
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
            minifiedSizeBytes: String
            installCount: String
            checksum: String
            tarballUrl: String
            status: String
            publishedAt: String
            publishedByUserId: Int
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

        input UpdatePackageVersionInput {
            description: String
            readmeText: String
            license: String
            assetSizeBytes: Int
            status: String
        }
    `;
};

const query = () => {
    return `
        version(packageName: String!, version: String!): VersionType
        versions(packageName: String, limit: Int, offset: Int): [VersionType]
        packageUpdates(days: Int!): Int
    `;
};

const mutation = () => {
    return `
        createVersion(input: CreatePackageVersionInput!): SingleVersionType
        updateVersion(packageName: String!, version: String!, input: UpdatePackageVersionInput!): SingleVersionType
        deleteVersion(packageName: String!, version: String!): Boolean
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        version: async (_: any, args: { packageName: string; version: string }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'version');
            const result = await Controllers.PackageVersion.getVersion({ packageName: args.packageName, version: args.version }, fields);

            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Package version not found');
            }
            return result.version;
        },
        versions: async (_: any, args: { packageName?: string; limit?: number; offset?: number }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'versions');
            const result = await Controllers.PackageVersion.getVersions(args, fields);
            return result.versions;
        },
        packageUpdates: async (_: any, args: { days: number }) => {
            const result = await Controllers.PackageVersion.getPackageUpdates(args);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.count;
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
        updateVersion: async (_: any, args: { packageName: string; version: string; input: Record<string, unknown> }) => {
            const result = await Controllers.PackageVersion.updateVersion({
                packageName: args.packageName,
                version: args.version,
                input: args.input as any,
            });
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Update failed');
            }
            return result.version;
        },
        deleteVersion: async (_: any, args: { packageName: string; version: string }) => {
            const result = await Controllers.PackageVersion.deleteVersion(args);
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
