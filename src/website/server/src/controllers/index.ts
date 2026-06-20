import AuthController from "./AuthController";
import Packages from "./PackageController";
import Users from "./UsersController";
import PackageVersion from "./PackageVersionController";
import Installations from "./InstallationsController";
import Organizations from "./OrganizationController";
import Metrics from "./MetricsController";
import Downloads from "./DownloadsController";

export const Controllers = {
    Auth: AuthController,
    Packages,
    Users,
    PackageVersion,
    Installations,
    Organizations,
    Metrics,
    Downloads,
}
