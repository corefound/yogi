import { Controllers } from '../controllers';

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
        }
    `;
};

const query = () => {
    return `
        user: UsersType
    `;
};

const mutation = () => {
    return ``;
};

const subscription = () => {
    return ``;
};

const { user } = Controllers.Users;

const resolvers = {
    query: {
        user,
    },

    mutation: {},

    subscription: {},
};

export default {
    type,
    query,
    mutation,
    subscription,
    resolvers,
};