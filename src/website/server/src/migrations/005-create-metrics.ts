import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("metrics", {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
        value: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        label: { type: DataTypes.STRING(255), allowNull: true },
        body: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
    });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("metrics");
}
