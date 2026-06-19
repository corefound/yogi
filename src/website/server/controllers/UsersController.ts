import { Models } from "../models";
import { CreateUserSchema, type CreateUserInput, GetUserSchema } from "../schemas/user.schema";

export class UsersController {
    static async createUser(params: unknown) {
        try {
            const parsed = CreateUserSchema.parse(params);
            const userData = {
                ...parsed,
                displayName: parsed.displayName ?? null,
                avatarUrl: parsed.avatarUrl ?? null,
                profileUrl: parsed.profileUrl ?? null,
                email: parsed.email ?? null,
                role: parsed.role || "user",
                status: parsed.status || "active",
                lastLoginAt: parsed.lastLoginAt || null,
            };
            const user = await Models.Users.create(userData as any);
            return { user };
        } catch (error) {
            return { error };
        }
    }

    static async user(params: unknown, attributes: any = {}) {
        try {
            const parsed = GetUserSchema.parse(params);
            const user = await Models.Users.findOne({
                where: { githubLogin: parsed.name },
                attributes: [...attributes.user || []],
            });

            return { user };
        } catch (error) {
            return { error };
        }
    }
}

export default UsersController;
