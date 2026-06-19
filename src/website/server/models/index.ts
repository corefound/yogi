import Packages from './PackagesModel';
import Users from './UsersModel';
import PackageVersion from './PackageVersionModel';
import InstallationsModel from './InstallationsModel';

// User ↔ Package using name as foreignKey
Packages.belongsTo(Users, { foreignKey: 'name', as: 'owner' });
Users.hasMany(Packages, { foreignKey: 'name', as: 'packages' });


// Package ↔ PackageVersion
Packages.hasMany(PackageVersion, {
    foreignKey: "packageName", // columna en PackageVersion
    sourceKey: "name",         // columna en Packages
    as: "versions",
});

PackageVersion.belongsTo(Packages, {
    foreignKey: "packageName", // columna en PackageVersion
    targetKey: "name",         // columna en Packages
    as: "package",
});
// Installations ↔ PackageVersion (via packageVersionId)
InstallationsModel.belongsTo(PackageVersion, { foreignKey: 'packageVersionId', as: 'version' });
PackageVersion.hasMany(InstallationsModel, { foreignKey: 'packageVersionId', as: 'installations' });

export const Models = {
    Packages,
    Users,
    PackageVersion,
    InstallationsModel,
}
