import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("organizations", {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        display_name: { type: DataTypes.STRING(255), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        avatar_url: { type: DataTypes.STRING(512), allowNull: true },
        owner_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
    });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("organizations");
}
