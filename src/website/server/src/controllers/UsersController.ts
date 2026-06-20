import { Models } from "../models";
import { CreateUserSchema, type CreateUserInput, GetUserSchema, UpdateUserSchema, type UpdateUserInput } from "../schemas/user.schema";

export class UsersController {
    static async getUsers(params: { limit?: number; offset?: number } = {}, attributes: any = {}) {
        const { limit, offset } = params;
        const attrs = [...(attributes.user || [])];
        const users = await Models.Users.findAll({
            ...(attrs.length ? { attributes: attrs } : {}),
            limit: limit ? Math.min(limit, 100) : undefined,
            offset: offset ?? undefined,
        });
        return { users };
    }

    static async user(params: unknown, attributes: any = {}) {
        try {
            const parsed = GetUserSchema.parse(params);
            const attrs = [...(attributes.user || [])];
            const user = await Models.Users.findOne({
                where: { githubLogin: parsed.name },
                ...(attrs.length ? { attributes: attrs } : {}),
            });

            return { user };
        } catch (error) {
            return { error };
        }
    }

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

    static async updateUser(params: { name: string; input: UpdateUserInput }) {
        try {
            const { name, input } = params;
            const parsed = UpdateUserSchema.parse(input);
            const [affected] = await Models.Users.update(parsed as any, {
                where: { githubLogin: name },
            });
            if (affected === 0) {
                return { error: { message: 'User not found' } };
            }
            const user = await Models.Users.findOne({ where: { githubLogin: name } });
            return { user };
        } catch (error) {
            return { error };
        }
    }

    static async deleteUser(params: { name: string }) {
        try {
            const { name } = params;
            const affected = await Models.Users.destroy({ where: { githubLogin: name } });
            if (affected === 0) {
                return { error: { message: 'User not found' } };
            }
            return { success: true };
        } catch (error) {
            return { error };
        }
    }
}

export default UsersController;
