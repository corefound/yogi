const DEVICE_CODE_URL = "https://github.com/login/device/code";
const TOKEN_URL = "https://github.com/login/oauth/access_token";

export async function requestDeviceCode(clientId: string): Promise<{ deviceCode: string; userCode: string; verificationUri: string; interval: number; expiresIn: number }> {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("scope", "read:user user:email");

    const res = await fetch(DEVICE_CODE_URL, {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: params,
    });

    const data = await res.json();
    if (data.error) {
        throw new Error(`GitHub device code error: ${data.error_description || data.error}`);
    }
    return {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        interval: data.interval || 5,
        expiresIn: data.expires_in || 900,
    };
}

export async function pollForAccessToken(clientId: string, deviceCode: string, interval: number): Promise<{ accessToken: string; tokenType: string }> {
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("device_code", deviceCode);
    params.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");

    for (let i = 0; i < 60; i++) {
        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: { "Accept": "application/json" },
            body: params,
        });

        const data = await res.json();
        if (data.error === "authorization_pending") {
            await new Promise(r => setTimeout(r, interval * 1000));
            continue;
        }
        if (data.error === "slow_down") {
            await new Promise(r => setTimeout(r, (interval + 5) * 1000));
            continue;
        }
        if (data.error) {
            throw new Error(`GitHub token error: ${data.error_description || data.error}`);
        }
        if (data.access_token) {
            return {
                accessToken: data.access_token,
                tokenType: data.token_type,
            };
        }
        await new Promise(r => setTimeout(r, interval * 1000));
    }
    throw new Error("Device code polling timed out");
}

export async function fetchGitHubUser(token: string): Promise<{ id: number; login: string; name: string | null; avatarUrl: string | null; htmlUrl: string | null; email: string | null }> {
    const userRes = await fetch("https://api.github.com/user", {
        headers: {
            "Authorization": `${token}`,
            "Accept": "application/vnd.github.v3+json",
        },
    });
    if (!userRes.ok) {
        throw new Error(`GitHub API error: ${userRes.status}`);
    }
    const user = await userRes.json();

    let email: string | null = user.email;
    if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
            headers: {
                "Authorization": `${token}`,
                "Accept": "application/vnd.github.v3+json",
            },
        });
        if (emailsRes.ok) {
            const emails = await emailsRes.json();
            const primary = emails.find((e: any) => e.primary && !e.verified === false);
            email = primary ? primary.email : (emails[0]?.email || null);
        }
    }

    return {
        id: user.id,
        login: user.login,
        name: user.name,
        avatarUrl: user.avatar_url,
        htmlUrl: user.html_url,
        email,
    };
}
