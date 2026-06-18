import express from 'express';
import cors from 'cors';
import { db } from './config/db';
import { RpcHandlers } from './routes/rpc';

const PORT = process.env.PORT || 3456;
const app = express();

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

db.authenticate().then(async () => {
    await db.sync({ logging: false });
    app.listen(PORT, () => {
        console.log(`Yogi Registry Server running on http://localhost:${PORT}`);
    });
}).catch((error) => {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
});
