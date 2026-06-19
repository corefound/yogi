import { GraphQLJSON } from 'graphql-type-json';
import userGQL from "./userGQL";

export const typeDefs = `
    scalar JSON
    scalar JSONObject
    ${userGQL.type()}
    

    type Query {
        ${userGQL.query()}
    }

    type Mutation {
        ${userGQL.mutation()}
    }

    type Subscription {
        ${userGQL.subscription()}
    }
`;


export const resolvers = {
    JSON: GraphQLJSON,
    Query: {
        ...userGQL.resolvers.query,

    },

    Mutation: {
        ...userGQL.resolvers.mutation,

    },

    Subscription: {
        ...userGQL.resolvers.subscription,
    }
}

