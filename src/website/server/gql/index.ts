import { GraphQLJSON } from 'graphql-type-json';
import { Models } from '../models';
import userGQL from "./userGQL";
import packageGQL from "./packageGQL";
import packageVersionGQL from "./packageVersionGQL";
import installationGQL from "./installationGQL";

const allGql = [userGQL, packageGQL, packageVersionGQL, installationGQL];

const subs = allGql.map(g => g.subscription()).filter(Boolean).join('\n');
const mutations = allGql.map(g => g.mutation()).filter(Boolean).join('\n');

export const typeDefs = `
    scalar JSON
    scalar JSONObject

    ${allGql.map(g => g.type()).join('\n')}
    ${allGql.map(g => g.inputTypes()).join('\n')}

    type Query {
        ${allGql.map(g => g.query()).join('\n')}
    }

    ${mutations ? `type Mutation {\n${mutations}\n}` : ''}
    ${subs ? `type Subscription {\n${subs}\n}` : ''}
`;


const resolverExtras: Record<string, object> = {};

if (mutations) {
    resolverExtras.Mutation = Object.assign(
        {},
        ...allGql.map(g => g.resolvers.mutation)
    );
}

if (subs) {
    resolverExtras.Subscription = Object.assign(
        {},
        ...allGql.map(g => g.resolvers.subscription)
    );
}

// --- Type resolvers for nested relationships ---

// UsersType → packages (as WithOutOwnerPackagesType, no owner recursion)
resolverExtras.UsersType = {
    packages: async (parent: any) => {
        const user = await Models.Users.findOne({
            where: { githubLogin: parent.githubLogin },
            include: [{ model: Models.Packages, as: 'packages' }]
        });
        return user?.packages || [];
    },
};

// PackagesType → owner (as SingleUsersType, no packages recursion) + versions
resolverExtras.PackagesType = {
    owner: async (parent: any) => {
        const pkg = await Models.Packages.findByPk(parent.id, {
            include: [{ model: Models.Users, as: 'owner' }]
        });
        return pkg?.owner || null;
    },
    versions: async (parent: any) => {
        const pkg = await Models.Packages.findByPk(parent.id, {
            include: [{ model: Models.PackageVersion, as: 'versions' }]
        });
        return pkg?.versions || [];
    },
};

// WithOutOwnerPackagesType → versions (no owner field)
resolverExtras.WithOutOwnerPackagesType = {
    versions: async (parent: any) => {
        const pkg = await Models.Packages.findByPk(parent.id, {
            include: [{ model: Models.PackageVersion, as: 'versions' }]
        });
        return pkg?.versions || [];
    },
};

// VersionType → package (as SinglePackagesType) + installations
resolverExtras.VersionType = {
    package: async (parent: any) => {
        const ver = await Models.PackageVersion.findByPk(parent.id, {
            include: [{ model: Models.Packages, as: 'package' }]
        });
        return ver?.package || null;
    },
    installations: async (parent: any) => {
        const ver = await Models.PackageVersion.findByPk(parent.id, {
            include: [{ model: Models.InstallationsModel, as: 'installations' }]
        });
        return ver?.installations || [];
    },
};

export const resolvers = {
    JSON: GraphQLJSON,
    Query: Object.assign({}, ...allGql.map(g => g.resolvers.query)),
    ...resolverExtras,
}

