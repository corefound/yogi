import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';
import { wrapCache, delCache, delCacheByPattern } from '../lib/redis-cache';

const type = () => {
    return `
        type CategoryType {
            name: String
            slug: String
            packageCount: Int
        }

        type CategoriesResultType {
            categories: [CategoryType]
            remainingPackageCount: Int
        }

        type SearchResultType {
            packages: [PackagesType]
            organizations: [OrganizationType]
        }

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
            logo: String
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
            logo: String
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
            logo: String
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
            logo: String
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
            logo: String
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
            logo: String
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
        categories: [CategoryType]
        categoriesList(limit: Int): CategoriesResultType
        category(slug: String!): CategoryType
        packagesByCategory(slug: String!): [PackagesType]
        search(query: String!, limit: Int): SearchResultType
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
            const cacheKey = `gql: packages:${ args.limit ?? 'all' }:${ args.offset ?? '0' }`;
            return wrapCache(cacheKey, 20, async () => {
                const fields = getQueryResponseFields(info.fieldNodes, 'packages');
                const result = await Controllers.Packages.getAllPackages(args, fields);
                return result.packages;
            });
        },
        package: async (_: any, args: { name: string }, context: any, info: GraphQLResolveInfo) => {
            const cacheKey = `gql: package:${ args.name }`;
            return wrapCache(cacheKey, 20, async () => {
                const fields = getQueryResponseFields(info.fieldNodes, 'package');
                const result = await Controllers.Packages.getPackage(args, fields);
                if (result.error) {
                    const err = result.error as { message?: string };
                    throw new GraphQLError(err.message || 'Package not found');
                }
                return result.package;
            });
        },
        trendingPackages: async (_: any, args: { limit?: number }, context: any, info: GraphQLResolveInfo) => {
            const cacheKey = `gql: trendingPackages:${ args.limit ?? '10' }`;
            return wrapCache(cacheKey, 20, async () => {
                const fields = getQueryResponseFields(info.fieldNodes, 'trendingPackages');
                const result = await Controllers.Packages.getTrendingPackages(args, fields);
                return result.packages;
            });
        },
        categories: async () => {
            const cacheKey = `gql: categories`;
            return wrapCache(cacheKey, 20, async () => {
                const result = await Controllers.Packages.getCategories();
                return result.categories;
            });
        },
        categoriesList: async (_: any, args: { limit?: number }) => {
            const cacheKey = `gql: categoriesList:${ args.limit ?? 'all' }`;
            return wrapCache(cacheKey, 20, async () => {
                return await Controllers.Packages.getCategories({ limit: args.limit });
            });
        },
        category: async (_: any, args: { slug: string }) => {
            const cacheKey = `gql: category:${ args.slug }`;
            return wrapCache(cacheKey, 20, async () => {
                return await Controllers.Packages.getCategory({ slug: args.slug });
            });
        },
        packagesByCategory: async (_: any, args: { slug: string }, context: any, info: GraphQLResolveInfo) => {
            const cacheKey = `gql: packagesByCategory:${ args.slug }`;
            return wrapCache(cacheKey, 20, async () => {
                const fields = getQueryResponseFields(info.fieldNodes, 'packagesByCategory');
                const result = await Controllers.Packages.getPackagesByCategory({ slug: args.slug }, fields);
                return result.packages;
            });
        },
        search: async (_: any, args: { query: string; limit?: number }, context: any, info: GraphQLResolveInfo) => {
            if (!args.query || args.query.trim().length < 2) return { packages: [], organizations: [] };
            const cacheKey = `gql: search:${ args.query }:${ args.limit ?? 5 }`;
            return wrapCache(cacheKey, 20, async () => {
                return await Controllers.Packages.search({ query: args.query, limit: args.limit });
            });
        },
    },

    mutation: {
        createPackage: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Packages.createPackage(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            await delCacheByPattern('gql:packages:*');
            await delCacheByPattern('gql:trendingPackages:*');
            await delCacheByPattern('gql:categories');
            await delCacheByPattern('gql:categoriesList:*');
            await delCacheByPattern('gql:packagesByCategory:*');
            return result.package;
        },
        updatePackage: async (_: any, args: { name: string; input: Record<string, unknown> }) => {
            const result = await Controllers.Packages.updatePackage({ name: args.name, input: args.input as any });
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Update failed');
            }
            await delCacheByPattern('gql:packages:*');
            await delCache(`gql: package:${ args.name }`);
            await delCacheByPattern('gql:trendingPackages:*');
            await delCacheByPattern('gql:categories');
            await delCacheByPattern('gql:categoriesList:*');
            await delCacheByPattern('gql:packagesByCategory:*');
            return result.package;
        },
        upsertPackage: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Packages.upsertPackage(args.input as any);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            const name = args.input.fullName || args.input.name;
            await delCacheByPattern('gql:packages:*');
            if (name) await delCache(`gql: package:${ name }`);
            await delCacheByPattern('gql:trendingPackages:*');
            await delCacheByPattern('gql:categories');
            await delCacheByPattern('gql:categoriesList:*');
            await delCacheByPattern('gql:packagesByCategory:*');
            return result.package;
        },
        deletePackage: async (_: any, args: { name: string }) => {
            const result = await Controllers.Packages.deletePackage(args);
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'Delete failed');
            }
            await delCacheByPattern('gql:packages:*');
            await delCache(`gql: package:${ args.name }`);
            await delCacheByPattern('gql:trendingPackages:*');
            await delCacheByPattern('gql:categories');
            await delCacheByPattern('gql:categoriesList:*');
            await delCacheByPattern('gql:packagesByCategory:*');
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
