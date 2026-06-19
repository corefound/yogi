import express from 'express';
import cors from 'cors';
import { db } from './config/db';
import { RpcHandlers } from './routes/rpc';
import { ApolloServer } from '@apollo/server';
// import { KeyvAdapter } from "@apollo/utils.keyvadapter";
import { typeDefs, resolvers } from './gql';
// import { keyvRedis } from './redis';
import http from 'http';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';

const PORT = process.env.PORT || 3456;
const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '1mb' }));


app.post('/rpc', async (req, res) => {
    try {
        const result = await RpcHandlers.dispatch(req.body);
        res.json(result);
    } catch (error) {
        console.error('RPC error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
})


const server = new ApolloServer({
    typeDefs,
    resolvers,
    // csrfPrevention: false,
    // // cache: new KeyvAdapter(keyvRedis),
    // // formatError,
    // plugins: [
    //     ApolloServerPluginDrainHttpServer({ httpServer })
    // ]
});

// app.use('/graphql',
//     cors<cors.CorsRequest>({
//         origin: "*",
//     }),
//     express.json(),
//     expressMiddleware(server, {
//         // context: async ({ req, res }) => {
//         //     return { req, res };
//         // }
//     })
// );

db.authenticate().then(async () => {
    await db.sync({ logging: false });
    // await server.start();

    httpServer.listen(PORT, () => {
        console.log(`Yogi Registry Server running on http://localhost:${PORT}`);
    });

}).catch((error) => {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
});
