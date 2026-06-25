import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.addColumn("packages", "logo", {
        type: DataTypes.STRING(2048),
        allowNull: true,
    });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.removeColumn("packages", "logo");
}
