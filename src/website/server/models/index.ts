import Packages from './PackagesModel';
import Users from './UsersModel';
import PackageVersion from './PackageVersionModel';
import InstallationsModel from './InstallationsModel';

// User ↔ Package
Packages.belongsTo(Users, { foreignKey: 'ownerId', as: 'owner' });
Users.hasMany(Packages, { foreignKey: 'ownerId', as: 'packages' });

// Package ↔ PackageVersion
PackageVersion.belongsTo(Packages, { foreignKey: 'packageId', as: 'package' });
Packages.hasMany(PackageVersion, { foreignKey: 'packageId', as: 'versions' });


// Installations ↔ PackageVersion (via packageVersionId)
InstallationsModel.belongsTo(PackageVersion, { foreignKey: 'packageVersionId', as: 'packageVersion' });
PackageVersion.hasMany(InstallationsModel, { foreignKey: 'packageVersionId', as: 'installations' });

export const Models = {
    Packages,
    Users,
    PackageVersion,
    InstallationsModel,
}
