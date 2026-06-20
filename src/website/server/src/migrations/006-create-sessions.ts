import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("sessions", {
        id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        sid: { type: DataTypes.STRING(36), allowNull: false, unique: true },
        user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        token: { type: DataTypes.TEXT, allowNull: false },
        user_agent: { type: DataTypes.STRING(512), allowNull: true },
        ip_address: { type: DataTypes.STRING(45), allowNull: true },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        last_activity_at: { type: DataTypes.DATE, allowNull: true },
        revoked_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex("sessions", ["sid"], { unique: true });
    await queryInterface.addIndex("sessions", ["user_id"]);
    await queryInterface.addIndex("sessions", ["expires_at"]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("sessions");
}
