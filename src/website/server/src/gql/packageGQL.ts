import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';

const type = () => {
    return `
        type PackagesType {
            id: Int
            scope: String
            name: String
            fullName: String
            displayName: String
            repoFullName: String
            githubRepoId: Int
            description: String
            readmeText: String
            license: String
            homepageUrl: String
            repositoryUrl: String
            documentationUrl: String
            visibility: String
            status: String
            verificationStatus: String
            totalDownloads: Int
            weeklyDownloads: Int
            versionsCount: Int
            dependenciesCount: Int
            dependentsCount: Int
            latestVersion: String
            keywords: [String]
            platforms: [String]
            maintainers: [JSON]
            security: JSON
            downloadTrend: [JSON]
            createdAt: String
            updatedAt: String
            owner: SingleUsersType
            versions: [VersionType]
        }

        type WithOutOwnerPackagesType {
            id: Int
            scope: String
            name: String
            fullName: String
            displayName: String
            repoFullName: String
            githubRepoId: Int
            description: String
            readmeText: String
            license: String
            homepageUrl: String
            repositoryUrl: String
            documentationUrl: String
            visibility: String
            status: String
            verificationStatus: String
            totalDownloads: Int
            weeklyDownloads: Int
            versionsCount: Int
            dependenciesCount: Int
            dependentsCount: Int
            latestVersion: String
            keywords: [String]
            platforms: [String]
            maintainers: [JSON]
            security: JSON
            downloadTrend: [JSON]
            createdAt: String
            updatedAt: String
            versions: [WithoutPackagesVersionType]
        }

        type SinglePackagesType {
            id: Int
            scope: String
            name: String
            fullName: String
            displayName: String
            repoFullName: String
            githubRepoId: Int
            description: String
            readmeText: String
            license: String
            homepageUrl: String
            repositoryUrl: String
            documentationUrl: String
            visibility: String
            status: String
            verificationStatus: String
            totalDownloads: Int
            weeklyDownloads: Int
            versionsCount: Int
            dependenciesCount: Int
            dependentsCount: Int
            latestVersion: String
            keywords: [String]
            platforms: [String]
            maintainers: [JSON]
            security: JSON
            downloadTrend: [JSON]
            createdAt: String
            updatedAt: String
        }
    `;
};

const inputTypes = () => {
    return `
        input CreatePackageInput {
            name: String!
            scope: String
            fullName: String!
            description: String
            readmeText: String
            license: String
            ownerUserId: Int
            repositoryUrl: String
            homepageUrl: String
            documentationUrl: String
            visibility: String
        }

        input UpdatePackageInput {
            description: String
            readmeText: String
            license: String
            repositoryUrl: String
            homepageUrl: String
            documentationUrl: String
            visibility: String
            status: String
        }

        input UpsertPackageInput {
            name: String!
            scope: String
            fullName: String!
            description: String
            readmeText: String
            license: String
            ownerUserId: Int
            repositoryUrl: String
            homepageUrl: String
            documentationUrl: String
            visibility: String
        }
    `;
};

const query = () => {
    return `
        packages(limit: Int, offset: Int): [PackagesType]
        package(name: String!): PackagesType
        trendingPackages(limit: Int): [PackagesType]
    `;
};

const mutation = () => {
    return `
        createPackage(input: CreatePackageInput!): PackagesType
        updatePackage(name: String!, input: UpdatePackageInput!): PackagesType
        upsertPackage(input: UpsertPackageInput!): PackagesType
        deletePackage(name: String!): Boolean
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        packages: async (_: any, args: { limit?: number; offset?: number }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'packages');
            const result = await Controllers.Packages.getAllPackages(args, fields);
            return result.packages;
        },
        package: async (_: any, args: { name: string }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'package');
            const result = await Controllers.Packages.getPackage(args, fields);
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Package not found');
            }
            return result.package;
        },
        trendingPackages: async (_: any, args: { limit?: number }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'trendingPackages');
            const result = await Controllers.Packages.getTrendingPackages(args, fields);
            return result.packages;
        },
    },

    mutation: {
        createPackage: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Packages.createPackage(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.package;
        },
        updatePackage: async (_: any, args: { name: string; input: Record<string, unknown> }) => {
            const result = await Controllers.Packages.updatePackage({ name: args.name, input: args.input as any });
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Update failed');
            }
            return result.package;
        },
        upsertPackage: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Packages.upsertPackage(args.input as any);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.package;
        },
        deletePackage: async (_: any, args: { name: string }) => {
            const result = await Controllers.Packages.deletePackage(args);
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
