import { GraphQLError, GraphQLResolveInfo } from 'graphql';
import { Controllers } from '../controllers';
import { getQueryResponseFields } from '../helpers';

const type = () => {
    return `
        type UsersType {
            githubUserId: String
            githubLogin: String
            displayName: String
            avatarUrl: String
            profileUrl: String
            email: String
            role: String
            status: String
            lastLoginAt: String
            packages: [WithOutOwnerPackagesType]
        }

        type SingleUsersType {
            githubUserId: String
            githubLogin: String
            displayName: String
            avatarUrl: String
            profileUrl: String
            email: String
            role: String
            status: String
            lastLoginAt: String
        }
    `;
};

const inputTypes = () => {
    return `
        input CreateUserInput {
            githubUserId: Int!
            githubLogin: String!
            displayName: String
            avatarUrl: String
            profileUrl: String
            email: String
            role: String
            status: String
            lastLoginAt: String
        }

        input GetUserInput {
            name: String!
        }
    `;
};

const query = () => {
    return `
        user(name: String!): UsersType
    `;
};

const mutation = () => {
    return `
        createUser(input: CreateUserInput!): UsersType
    `;
};

const subscription = () => {
    return ``;
};

const resolvers = {
    query: {
        user: async (_: any, args: { name: string }, context: any, info: GraphQLResolveInfo) => {
            const fields = getQueryResponseFields(info.fieldNodes, 'user');
            const result = await Controllers.Users.user({ name: args.name }, fields);
           
            if (result.error) {
                const err = result.error as { message?: string };
                throw new GraphQLError(err.message || 'User not found');
            }
            return result.user;
        },
    },

    mutation: {
        createUser: async (_: any, args: { input: Record<string, unknown> }) => {
            const result = await Controllers.Users.createUser(args.input);
            if (result.error) {
                throw new GraphQLError(String(result.error));
            }
            return result.user;
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
