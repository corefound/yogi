import Packages from './PackagesModel';
import Users from './UsersModel';
import PackageVersion from './PackageVersionModel';
import InstallationsModel from './InstallationsModel';
import Organizations from './OrganizationsModel';
import Metrics from './MetricsModel';
import Sessions from './SessionsModel';

// ── Packages ↔ Users ──────────────────────────────────────
Packages.belongsTo(Users, { foreignKey: 'ownerUserId', as: 'owner' });
Users.hasMany(Packages, { foreignKey: 'ownerUserId', as: 'packages' });

// ── Packages ↔ PackageVersion ─────────────────────────────
Packages.hasMany(PackageVersion, {
    foreignKey: 'packageId',
    as: 'versions',
});
PackageVersion.belongsTo(Packages, {
    foreignKey: 'packageId',
    as: 'package',
});

// ── Packages → latestVersionRecord (self-referencing) ─────
Packages.belongsTo(PackageVersion, {
    foreignKey: 'latestVersionId',
    targetKey: 'id',
    as: 'latestVersionRecord',
});

// ── InstallationsModel ↔ PackageVersion ───────────────────
InstallationsModel.belongsTo(PackageVersion, {
    foreignKey: 'packageVersionId',
    as: 'version',
});
PackageVersion.hasMany(InstallationsModel, {
    foreignKey: 'packageVersionId',
    as: 'installations',
});

// ── Organizations ↔ Users ─────────────────────────────────
Organizations.belongsTo(Users, { foreignKey: 'ownerUserId', as: 'owner' });
Users.hasMany(Organizations, { foreignKey: 'ownerUserId', as: 'organizations' });

// ── Organizations ↔ Packages ──────────────────────────────
Organizations.hasMany(Packages, { foreignKey: 'ownerOrganizationId', as: 'packages' });
Packages.belongsTo(Organizations, { foreignKey: 'ownerOrganizationId', as: 'organization' });

// ── Sessions ↔ Users ──────────────────────────────────────
Sessions.belongsTo(Users, { foreignKey: 'userId', as: 'user' });
Users.hasMany(Sessions, { foreignKey: 'userId', as: 'sessions' });

export const Models = {
    Packages,
    Users,
    PackageVersion,
    InstallationsModel,
    Organizations,
    Metrics,
    Sessions,
}
