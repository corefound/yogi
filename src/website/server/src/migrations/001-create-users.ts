import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("users", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        github_user_id: { type: DataTypes.STRING, allowNull: false, unique: true },
        github_login: { type: DataTypes.STRING(100), allowNull: false },
        display_name: { type: DataTypes.STRING(150), allowNull: true },
        avatar_url: { type: DataTypes.STRING(512), allowNull: true },
        profile_url: { type: DataTypes.STRING(512), allowNull: true },
        email: { type: DataTypes.STRING(255), allowNull: true },
        role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "user" },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
        last_login_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
    });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("users");
}
