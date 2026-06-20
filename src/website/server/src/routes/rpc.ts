import { Controllers } from "../controllers";

type HandlerFn = (params: any) => Promise<any>;

const methodHandlers: Record<string, HandlerFn> = {
    // Packages
    "get_all_packages": (params: any) => Controllers.Packages.getAllPackages(params),
    "get_package": (params: any) => Controllers.Packages.getPackage(params),
    "create_package": (params: any) => Controllers.Packages.createPackage(params),
    "update_package": (params: any) => Controllers.Packages.updatePackage(params),
    "upsert_package": (params: any) => Controllers.Packages.upsertPackage(params),
    "delete_package": (params: any) => Controllers.Packages.deletePackage(params),

    // Users
    "get_all_users": (params: any) => Controllers.Users.getUsers(params),
    "get_user_by_name": (params: any) => Controllers.Users.user(params),
    "create_user": (params: any) => Controllers.Users.createUser(params),
    "update_user": (params: any) => Controllers.Users.updateUser(params),
    "delete_user": (params: any) => Controllers.Users.deleteUser(params),

    // Versions
    "get_all_versions": (params: any) => Controllers.PackageVersion.getVersions(params),
    "get_version": (params: any) => Controllers.PackageVersion.getVersion(params),
    "create_version": (params: any) => Controllers.PackageVersion.createVersion(params),
    "update_version": (params: any) => Controllers.PackageVersion.updateVersion(params),
    "delete_version": (params: any) => Controllers.PackageVersion.deleteVersion(params),

    // Installations
    "get_all_installations": (params: any) => Controllers.Installations.getInstallations(params),
    "get_installation": (params: any) => Controllers.Installations.getInstallation(params.id),
    "create_installation": (params: any) => Controllers.Installations.createInstallation(params),
    "update_installation": (params: any) => Controllers.Installations.updateInstallation(params),
    "delete_installation": (params: any) => Controllers.Installations.deleteInstallation(params),

    // Auth
    "yogi.login": (params: any) => Controllers.Auth.login(params),
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
