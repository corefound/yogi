import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';

const type = () => {
    return `
        type PackagesType {
            id: Int
            name: String
            repoFullName: String
            githubRepoId: Int
            description: String
            readmeText: String
            license: String
            homepage: String
            visibility: String
            status: String
            totalInstalls: Int
            totalVersions: Int
            createdAt: String
            updatedAt: String
            owner: SingleUsersType
            versions: [VersionType]
        }

        type WithOutOwnerPackagesType {
            id: Int
            name: String
            repoFullName: String
            githubRepoId: Int
            description: String
            readmeText: String
            license: String
            homepage: String
            visibility: String
            status: String
            totalInstalls: Int
            totalVersions: Int
            createdAt: String
            updatedAt: String
            versions: [WithoutPackagesVersionType]
        }

        type SinglePackagesType {
            id: Int
            name: String
            repoFullName: String
            githubRepoId: Int
            description: String
            readmeText: String
            license: String
            homepage: String
            visibility: String
            status: String
            totalInstalls: Int
            totalVersions: Int
            createdAt: String
            updatedAt: String
        }
    `;
};

const inputTypes = () => {
    return `
        input CreatePackageInput {
            name: String!
            repoFullName: String!
            githubRepoId: Int!
            ownerId: Int!
            description: String
            readmeText: String
            license: String
            homepage: String
            visibility: String
        }
    `;
};

const query = () => {
    return `
        packages: [PackagesType]
    `;
};

const mutation = () => {
    return `
        createPackage(input: CreatePackageInput!): PackagesType
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        packages: async (_: any, args: any, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'packages');
            const result = await Controllers.Packages.getAllPackages(fields);
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
