import { GraphQLJSON } from 'graphql-type-json';
import { GraphQLResolveInfo } from 'graphql';
import { Models } from '../models';
import { getQueryResponseFields } from '../helpers';
import userGQL from "./userGQL";
import packageGQL from "./packageGQL";
import packageVersionGQL from "./packageVersionGQL";
import installationGQL from "./installationGQL";
import organizationGQL from "./organizationGQL";
import metricsGQL from "./metricsGQL";
import downloadGQL from "./downloadGQL";

const allGql = [userGQL, packageGQL, packageVersionGQL, installationGQL, organizationGQL, metricsGQL, downloadGQL];

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
    packages: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "packages");
        const user = await Models.Users.findOne({
            where: { githubLogin: parent.githubLogin },
            attributes: ['id', ...(fields?.user || [])],
            include: [{
                model: Models.Packages, as: 'packages',
                attributes: ['id', ...(fields?.packages || [])],
            }]
        });
        return user?.packages || [];
    },
};

// PackagesType → owner (as SingleUsersType, no packages recursion) + versions
resolverExtras.PackagesType = {
    owner: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "owner");
        const ownerFields = ['id', 'githubUserId', ...(fields?.owner || fields?.user || [])];
        const ownerId = parent.ownerUserId;
        if (!ownerId) return null;
        const user = await Models.Users.findByPk(ownerId, {
            attributes: ownerFields,
        });
        return user || null;
    },
    versions: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "versions");
        const pkg = await Models.Packages.findByPk(parent.id, {
            attributes: ['id'],
            include: [{
                model: Models.PackageVersion, as: 'versions',
                attributes: ['id', ...(fields?.versions || [])],
            }]
        });
        return pkg?.versions || [];
    },
};

// WithOutOwnerPackagesType → versions (no owner field)
resolverExtras.WithOutOwnerPackagesType = {
    versions: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "versions");
        const pkg = await Models.Packages.findByPk(parent.id, {
            attributes: ['id', ...(fields?.package || [])],
            include: [{
                model: Models.PackageVersion, as: 'versions',
                attributes: ['id', ...(fields?.versions || [])],
            }]
        });
        return pkg?.versions || [];
    },
};

// OrganizationType → owner + packages
resolverExtras.OrganizationType = {
    owner: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "owner");
        const ownerFields = ['id', 'githubUserId', ...(fields?.owner || fields?.user || [])];
        const ownerId = parent.ownerUserId;
        if (!ownerId) return null;
        const user = await Models.Users.findByPk(ownerId, {
            attributes: ownerFields,
        });
        return user || null;
    },
    packages: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "packages");
        const org = await Models.Organizations.findByPk(parent.id, {
            attributes: ['id'],
            include: [{
                model: Models.Packages, as: 'packages',
                attributes: ['id', ...(fields?.packages || [])],
            }]
        });
        return org?.packages || [];
    },
};

// WithoutPackagesVersionType → installations (no package field, avoids recursion)
resolverExtras.WithoutPackagesVersionType = {
    installations: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "installations");
        const ver = await Models.PackageVersion.findByPk(parent.id, {
            attributes: ['id', ...(fields?.version || [])],
            include: [{
                model: Models.InstallationsModel, as: 'installations',
                attributes: ['id', ...(fields?.installations || [])],
            }]
        });
        return ver?.installations || [];
    },
};

// VersionType → package (as SinglePackagesType) + installations
resolverExtras.VersionType = {
    package: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "package");
        const ver = await Models.PackageVersion.findByPk(parent.id, {
            attributes: ['id', ...fields?.version || []],
            include: [{
                model: Models.Packages, as: 'package',
                attributes: ['id', ...(fields?.package || [])],
            }]
        });
        return ver?.package || null;
    },
    installations: async (parent: any, args: any, context: any, info: GraphQLResolveInfo) => {
        const fields = getQueryResponseFields(info.fieldNodes, "installations");
        const ver = await Models.PackageVersion.findByPk(parent.id, {
            attributes: ['id', ...(fields?.version || [])],
            include: [{
                model: Models.InstallationsModel, as: 'installations',
                attributes: ['id', ...(fields?.installations || [])],
            }]
        });
        return ver?.installations || [];
    },
};

export const resolvers = {
    JSON: GraphQLJSON,
    Query: Object.assign({}, ...allGql.map(g => g.resolvers.query)),
    ...resolverExtras,
}
