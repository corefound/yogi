import { Models } from "../models";
import { requestDeviceCode, pollForAccessToken, fetchGitHubUser } from "../utils/github";

export class AuthController {
    static async login(params: { githubClientId: string }) {
        const { githubClientId } = params;

        if (!githubClientId) {
            throw new Error("githubClientId is required");
        }

        const deviceCode = await requestDeviceCode(githubClientId);

        try {
            const { exec } = require("node:child_process");
            await exec(`open "${deviceCode.verificationUri}"`);
        } catch {
            // ignore if open fails (e.g. headless env)
        }

        console.log(`\n🔐 GitHub Device Login`);
        console.log(`   Go to: ${deviceCode.verificationUri}`);
        console.log(`   Enter code: ${deviceCode.userCode}\n`);

        const token = await pollForAccessToken(githubClientId, deviceCode.deviceCode, deviceCode.interval);
        const githubUser = await fetchGitHubUser(token.accessToken);

        const [user] = await Models.Users.findOrCreate({
            where: { githubLogin: githubUser.login },
            defaults: {
                githubUserId: String(githubUser.id),
                githubLogin: githubUser.login,
                displayName: githubUser.name,
                avatarUrl: githubUser.avatarUrl,
                profileUrl: githubUser.htmlUrl,
                email: githubUser.email,
                role: "user",
                status: "active",
                lastLoginAt: new Date(),
            },
        });

        if (user.githubUserId !== String(githubUser.id)) {
            await Models.Users.update(
                { githubUserId: String(githubUser.id), displayName: githubUser.name, avatarUrl: githubUser.avatarUrl, profileUrl: githubUser.htmlUrl, email: githubUser.email, lastLoginAt: new Date() },
                { where: { id: user.id } }
            );
        } else {
            await Models.Users.update(
                { displayName: githubUser.name, avatarUrl: githubUser.avatarUrl, profileUrl: githubUser.htmlUrl, email: githubUser.email, lastLoginAt: new Date() },
                { where: { id: user.id } }
            );
        }

        const freshUser = await Models.Users.findOne({ where: { id: user.id } });
        return { user: freshUser };
    }
}

export default AuthController;
