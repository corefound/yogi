import { Controllers } from "../controllers";

const methodHandlers: Record<string, (body: any) => Promise<any>> = {
    "get_all_packages": Controllers.Packages.getAllPackages,
    "create_package": Controllers.Packages.createPackage,
    "create_user": Controllers.Users.createUser,
    "yogi.login": Controllers.Auth.login,
    "get_user_by_name": Controllers.Users.getUserByName,
};

export class RpcHandlers {
    static async dispatch(request: { method: string; params?: any; id?: string | number }) {
        const { method, params = {} } = request;


        const handler = methodHandlers[method];
        if (!handler) {
            return {
                jsonrpc: "2.0",
                error: { code: -32601, message: `Method not found: ${method}` },
            };
        }

        try {
            const result = await handler(params);
            return {
                jsonrpc: "2.0",
                result,
                id: request.id,
            };

        } catch (error) {
            return {
                jsonrpc: "2.0",
                error: { code: -32603, message: "Internal error", data: String(error) },
                id: request.id,
            };
        }
    }
}

export { methodHandlers };