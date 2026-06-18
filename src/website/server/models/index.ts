import Packages from './PackagesModel';
import Users from './UsersModel';

Packages.belongsTo(Users, { foreignKey: 'ownerId' });
Users.hasMany(Packages, { foreignKey: 'ownerId' });


export const Models = {
    Packages,
    Users
}
